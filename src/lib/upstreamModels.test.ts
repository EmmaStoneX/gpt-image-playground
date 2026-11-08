import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOpenAIProfile } from './apiProfiles'
import { resolveApiProfileModel } from './imageModels'
import { fetchUpstreamModels, parseUpstreamModels } from './upstreamModels'

afterEach(() => vi.unstubAllGlobals())

describe('上游模型列表', () => {
  it('只读取有效 ID，并保持上游顺序', () => {
    expect(parseUpstreamModels({ data: [
      { id: 'gpt-image-2' }, { id: ' custom-image ' }, { id: 'gpt-image-2' }, { name: 'missing' }, null,
    ] })).toEqual(['gpt-image-2', 'custom-image'])
    expect(() => parseUpstreamModels({ error: 'unauthorized' })).toThrow('模型列表格式无效')
  })

  it('从已配置的中转站读取模型，并使用对应密钥', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-image-2.5' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const profile = createDefaultOpenAIProfile({ baseUrl: 'https://api.zxvmax.com', apiKey: 'test-key' })
    expect(await fetchUpstreamModels(profile)).toEqual(['gpt-image-2.5'])
    expect(fetchMock).toHaveBeenCalledWith('https://api.zxvmax.com/v1/models', expect.objectContaining({
      headers: { Authorization: 'Bearer test-key' },
      cache: 'no-store',
    }))
  })

  it('上游选择持久化后，离线仍使用已选模型', () => {
    const profile = createDefaultOpenAIProfile({
      model: 'gpt-image-2, custom-image',
      selectedModel: 'custom-image',
    })
    expect(resolveApiProfileModel(profile).model).toBe('custom-image')
  })
})
