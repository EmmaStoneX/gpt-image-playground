import { storeImage } from '../lib/db'
import { useStore } from '../store'
import { DEFAULT_PARAMS, type TaskRecord } from '../types'

const cases = [
  ['竖图 9:16', 900, 1600, '#2450a7', '#8ac7ff'],
  ['横图 16:9', 1600, 900, '#245b57', '#c5e5cf'],
  ['方图 1:1', 1000, 1000, '#663982', '#e0addb'],
  ['竖图 2:3', 1000, 1500, '#8b5330', '#f0cf99'],
  ['横图 3:2', 1500, 1000, '#225f75', '#98d7df'],
  ['宽图 21:9', 2100, 900, '#56458a', '#bbc6fa'],
  ['竖图 4:5', 960, 1200, '#725d2b', '#f3dfa1'],
  ['横图 4:3', 1200, 900, '#87505c', '#f1b7ad'],
  ['长图 1:2', 800, 1600, '#295e47', '#b8dfba'],
] as const

function testImage(label: string, width: number, height: number, dark: string, light: string) {
  const titleY = width > height ? 0.58 : 0.34
  const sizeY = width > height ? 0.68 : 0.40
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width * 0.77}" cy="${height * 0.24}" r="${Math.min(width, height) * 0.14}" fill="white" opacity=".45"/>
    <path d="M0 ${height * 0.78} Q${width * 0.28} ${height * 0.48} ${width * 0.55} ${height * 0.75} T${width} ${height * 0.61} L${width} ${height} H0Z" fill="white" opacity=".16"/>
    <text x="${width * 0.08}" y="${height * titleY}" fill="white" font-family="Arial" font-size="${Math.min(width, height) * 0.09}" font-weight="700">${label}</text>
    <text x="${width * 0.08}" y="${height * sizeY}" fill="white" font-family="Arial" font-size="${Math.min(width, height) * 0.036}">${width} × ${height}</text>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export async function loadLayoutFixtures() {
  const tasks: TaskRecord[] = []
  for (const [index, [label, width, height, dark, light]] of cases.entries()) {
    const imageId = await storeImage(testImage(label, width, height, dark, light), 'generated')
    tasks.push({
      id: `layout-test-${index}`,
      prompt: label,
      params: { ...DEFAULT_PARAMS, size: `${width}x${height}` },
      inputImageIds: [],
      maskTargetImageId: null,
      maskImageId: null,
      outputImages: [imageId],
      status: 'done',
      error: null,
      createdAt: cases.length - index,
      finishedAt: cases.length - index,
      elapsed: 1000,
    })
  }
  useStore.setState({ tasks, filterStatus: 'all', filterFavorite: false, searchQuery: '' })
}

/** 在原应用中预览任务状态布局；只通过开发环境的 uiTest 参数启用。 */
export async function loadWorkspaceFixtures(mode: 'batch' | 'stream') {
  const now = Date.now()
  const batchId = now
  const labels = mode === 'batch'
    ? ['雨夜东京街头', '复古红色跑车', '雪山水墨画', '霓虹街景', '建筑草图', '未来城市']
    : ['未来城市日落', '玻璃树木画布', '雨夜街景', '雪山水墨画', '运动鞋棚拍', '手绘咖啡馆']
  const statuses = mode === 'batch'
    ? ['done', 'done', 'done', 'running', 'running', 'error'] as const
    : ['done', 'running', 'error', 'done', 'running', 'error'] as const
  const tasks: TaskRecord[] = []
  for (const [index, label] of labels.entries()) {
    const status = statuses[index]
    const imageId = status === 'done'
      ? await storeImage(testImage(label, 1200, 720, cases[index][3], cases[index][4]), 'generated')
      : null
    tasks.push({
      id: `workspace-${mode}-${index}`,
      ...(mode === 'batch' ? { batchId } : {}),
      ...(mode === 'batch' ? { batchTotal: 8 } : {}),
      prompt: label,
      params: { ...DEFAULT_PARAMS, size: '1536x1024' },
      apiProvider: index === 2 && mode === 'stream' ? 'fal' : 'openai',
      inputImageIds: [],
      outputImages: imageId ? [imageId] : [],
      status,
      error: status === 'error' ? index === 2 && mode === 'stream' ? '连接断开，正在恢复' : '请求中断' : null,
      falRecoverable: index === 2 && mode === 'stream',
      createdAt: now - index * 1000,
      finishedAt: status === 'running' ? null : now,
      elapsed: status === 'running' ? null : 1000,
    })
  }
  const referenceDataUrl = testImage('参考图', 1200, 720, '#224277', '#99cbf1')
  const referenceId = mode === 'stream' ? await storeImage(referenceDataUrl, 'upload') : ''
  useStore.setState({
    tasks,
    inputImages: mode === 'stream' ? [{ id: referenceId, dataUrl: referenceDataUrl }] : [],
    batchProgress: mode === 'batch' ? { id: batchId, total: 8, started: 6, finished: 4 } : null,
    filterStatus: 'all',
    filterFavorite: false,
    searchQuery: '',
  })
}
