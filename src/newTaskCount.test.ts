import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from './types'
import { DEFAULT_SETTINGS } from './lib/apiProfiles'
import { reuseConfig, retryTask, submitTask, useStore } from './store'

vi.mock('./lib/db', () => ({
  getAllTasks: vi.fn(async () => []),
  putTask: vi.fn(async () => ''),
  deleteTask: vi.fn(async () => undefined),
  clearTasks: vi.fn(async () => undefined),
  getImage: vi.fn(async () => undefined),
  getAllImages: vi.fn(async () => []),
  putImage: vi.fn(async () => ''),
  deleteImage: vi.fn(async () => undefined),
  clearImages: vi.fn(async () => undefined),
  storeImage: vi.fn(async () => ''),
}))

vi.mock('./lib/api', () => ({
  callImageApi: vi.fn(async ({ prompt }: { prompt: string }) => ({
    images: [], actualParams: {}, revisedPrompts: [prompt],
  })),
}))

describe('new task image count', () => {
  beforeEach(() => {
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS, apiKey: 'test-key', batchPromptEnabled: false },
      prompt: 'one prompt',
      inputImages: [],
      maskDraft: null,
      params: { ...DEFAULT_PARAMS, n: 4 },
      tasks: [],
      batchProgress: null,
      showToast: vi.fn(),
    })
  })

  it('submits one image even when a saved draft requested more', async () => {
    await submitTask()

    expect(useStore.getState().tasks[0].params.n).toBe(1)
    expect(useStore.getState().params.n).toBe(1)
  })

  it('submits one image per batch prompt', async () => {
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS, apiKey: 'test-key', batchPromptEnabled: true },
      prompt: 'first\n\n\nsecond',
    })

    await submitTask()
    await vi.waitFor(() => expect(useStore.getState().tasks).toHaveLength(2))

    expect(useStore.getState().tasks.map((task) => task.params.n)).toEqual([1, 1])
  })

  it('keeps historical count while reuse and new retry reset to one', async () => {
    const oldTask = {
      id: 'old', prompt: 'old prompt', params: { ...DEFAULT_PARAMS, n: 4 },
      inputImageIds: [], maskTargetImageId: null, maskImageId: null,
      outputImages: [], status: 'error' as const, error: 'failed',
      createdAt: 1, finishedAt: 2, elapsed: 1,
    }
    useStore.setState({ tasks: [oldTask] })

    await reuseConfig(oldTask)
    expect(useStore.getState().params.n).toBe(1)

    await retryTask(oldTask, 'new')
    expect(useStore.getState().tasks.find((task) => task.id === 'old')?.params.n).toBe(4)
    expect(useStore.getState().tasks.find((task) => task.id !== 'old')?.params.n).toBe(1)
  })
})
