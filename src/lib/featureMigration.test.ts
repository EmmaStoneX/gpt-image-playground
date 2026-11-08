import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { DEFAULT_SETTINGS, getActiveApiProfile, normalizeSettings } from './apiProfiles'
import { callImageApi } from './api'
import { splitBatchPrompts, runWithConcurrency } from './batchPrompts'
import { getParamDisabledReasons, normalizeParamsForSettings, normalizeStoredTaskParams } from './paramCompatibility'

const settingsFor = (model: string, apiMode: 'images' | 'responses' = 'images') => normalizeSettings({
  ...DEFAULT_SETTINGS,
  profiles: [{ ...DEFAULT_SETTINGS.profiles[0], model, apiMode, imageGenerationModel: 'gpt-image-2.6-flare' }],
})

describe('selected feature migration', () => {
  afterEach(() => vi.restoreAllMocks())

  it('resolves a selected model from a comma-separated provider list', () => {
    const settings = normalizeSettings({
      ...settingsFor('gpt-image-2.5, gpt-image-2.6-flare'),
      profiles: [{ ...DEFAULT_SETTINGS.profiles[0], model: 'gpt-image-2.5, gpt-image-2.6-flare', selectedModel: 'gpt-image-2.6-flare' }],
    })
    expect(getActiveApiProfile(settings).model).toBe('gpt-image-2.6-flare')
    expect(settings.profiles[0].model).toContain(',')
  })

  it('normalizes old stored params without dropping new defaults', () => {
    expect(normalizeStoredTaskParams({ size: '1024x1024' })).toMatchObject({
      size: '1024x1024', complexity: 'auto', frame_count: 9, frame_duration_ms: 200,
    })
  })

  it('disables 2.6-only params on 2.5', () => {
    const settings = settingsFor('gpt-image-2.5')
    expect(getParamDisabledReasons(settings).complexity).toBeTruthy()
    expect(getParamDisabledReasons(settings).gif).toBeTruthy()
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, output_format: 'gif', complexity: 'high' }, settings))
      .toMatchObject({ output_format: 'png', complexity: 'auto' })
  })

  it('sends 2.6 SVG author model and complexity in an Images request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'PHN2Zz48L3N2Zz4=' }] }), { status: 200 }))
    const settings = normalizeSettings({ ...settingsFor('gpt-image-2.6-flare'), profiles: [{ ...settingsFor('gpt-image-2.6-flare').profiles[0], streamImages: true }] })
    expect(getParamDisabledReasons(settings).complexity).toBeUndefined()
    await callImageApi({ settings: { ...settings, apiKey: 'test-key' }, prompt: 'vector', params: { ...DEFAULT_PARAMS, output_format: 'svg', complexity: 'medium' }, inputImageDataUrls: [] })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body).toMatchObject({ model: 'gpt-image-2.6-flare', output_format: 'svg', complexity: 'medium', svg: { model: 'gpt-6.1-sol' } })
    expect(body).not.toHaveProperty('stream')
  })

  it('sends GIF frames to the Responses image tool', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ output: [{ type: 'image_generation_call', result: 'aW1hZ2U=' }] }), { status: 200 }))
    const settings = normalizeSettings({ ...settingsFor('gpt-6.1-sol', 'responses'), profiles: [{ ...settingsFor('gpt-6.1-sol', 'responses').profiles[0], streamImages: true }] })
    await callImageApi({ settings: { ...settings, apiKey: 'test-key' }, prompt: 'animate', params: { ...DEFAULT_PARAMS, output_format: 'gif', frame_count: 4, frame_duration_ms: 120 }, inputImageDataUrls: [] })
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.tools[0]).toMatchObject({ model: 'gpt-image-2.6-flare', output_format: 'gif', frame_count: 4, frame_duration_ms: 120 })
    expect(body.tools[0]).not.toHaveProperty('complexity')
    expect(body.tools[0]).not.toHaveProperty('partial_images')
    expect(body).not.toHaveProperty('stream')
  })

  it('emits a streamed preview and uses only the final image as the result', async () => {
    const sse = [
      'data: {"type":"image_generation.partial_image","b64_json":"cHJldmlldw=="}',
      'data: {"type":"image_generation.completed","b64_json":"ZmluYWw="}',
      'data: [DONE]',
    ].join('\r\n\r\n') + '\r\n\r\n'
    const bytes = new TextEncoder().encode(sse)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 41))
        controller.enqueue(bytes.slice(41))
        controller.close()
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    const previews: string[] = []
    const settings = normalizeSettings({
      ...settingsFor('gpt-image-2.6-flare'),
      profiles: [{ ...settingsFor('gpt-image-2.6-flare').profiles[0], streamImages: true }],
    })
    const result = await callImageApi({ settings: { ...settings, apiKey: 'test-key' }, prompt: 'stream', params: DEFAULT_PARAMS, inputImageDataUrls: [], onPartialImage: (url) => previews.push(url) })
    expect(previews).toEqual(['data:image/png;base64,cHJldmlldw=='])
    expect(result.images).toEqual(['data:image/png;base64,ZmluYWw='])
  })

  it('splits batch prompts on two blank lines and stops before starting further work', async () => {
    const prompts = splitBatchPrompts('first\n\ninside\n\n\nsecond\n\n\nthird')
    expect(prompts).toEqual(['first\n\ninside', 'second', 'third'])
    const started: string[] = []
    await runWithConcurrency(prompts, 1, async (prompt) => { started.push(prompt) }, () => started.length >= 1)
    expect(started).toEqual(['first\n\ninside'])
  })
})
