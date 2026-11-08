import { useState } from 'react'
import type { RetryMode } from '../types'
import { retryTasks, stopBatchPrompts, useStore } from '../store'
import TaskGrid from './TaskGrid'

export default function TaskWorkspace({ mode, batchId }: { mode: 'batch' | 'stream'; batchId?: number }) {
  const tasks = useStore((state) => state.tasks)
  const batchProgress = useStore((state) => state.batchProgress)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const showToast = useStore((state) => state.showToast)
  const [retryMode, setRetryMode] = useState<RetryMode>('overwriteFailed')
  const [retrying, setRetrying] = useState(false)

  const batchTasks = batchId ? tasks.filter((task) => task.batchId === batchId) : []
  const streamTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 9)
  const visibleTasks = mode === 'batch' ? batchTasks : streamTasks
  const failedTasks = streamTasks.filter((task) => task.status === 'error' && !task.falRecoverable)
  const recoverableCount = streamTasks.filter((task) => task.falRecoverable).length
  const interruptedCount = streamTasks.filter((task) => task.error === '请求中断').length
  const runningCount = streamTasks.filter((task) => task.status === 'running').length
  const recoveryNotice = [
    recoverableCount ? `${recoverableCount} 个 fal 队列任务正在恢复` : '',
    interruptedCount ? `${interruptedCount} 个 OpenAI 请求已中断，可手动重试` : '',
    runningCount ? `${runningCount} 个任务正在生成` : '',
  ].filter(Boolean).join('；') || '已结束的任务可在此查看与重试'
  const activeBatch = mode === 'batch' && batchProgress?.id === batchId ? batchProgress : null
  const completedCount = batchTasks.filter((task) => task.status === 'done').length
  const failedBatchCount = batchTasks.filter((task) => task.status === 'error' && !task.falRecoverable).length
  const waitingCount = activeBatch ? Math.max(0, activeBatch.total - activeBatch.started) : 0
  const batchTotal = activeBatch?.total ?? batchTasks[0]?.batchTotal ?? batchTasks.length
  const progress = batchTotal ? Math.round(((completedCount + failedBatchCount) / batchTotal) * 100) : 0

  const beginRetry = () => {
    const targets = retryMode === 'overwriteAll'
      ? streamTasks.filter((task) => task.status !== 'running' && !task.falRecoverable)
      : failedTasks
    if (!targets.length || retrying) return
    const run = () => {
      setRetrying(true)
      void retryTasks(targets, retryMode).then(() => {
        showToast(`已处理 ${targets.length} 个任务`, 'success')
      }).catch((error) => {
        showToast(error instanceof Error ? error.message : String(error), 'error')
      }).finally(() => setRetrying(false))
    }
    if (retryMode === 'overwriteAll') {
      setConfirmDialog({
        title: '覆盖全部任务？',
        message: `将重新生成 ${targets.length} 个已结束任务，并替换其现有结果。`,
        confirmText: '重新生成',
        tone: 'warning',
        action: run,
      })
    } else run()
  }

  return <section className="space-y-5" aria-label={mode === 'batch' ? '批量生成任务' : '流式生成任务'}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-[22px] font-bold leading-8 tracking-tight text-[#18181b] dark:text-gray-100">{mode === 'batch' ? '批量生成任务' : '流式生成任务'}</h2>
        <p className="mt-1 text-[13px] leading-5 text-[#5b5b66] dark:text-gray-400">
          {mode === 'batch'
            ? `已提交 ${activeBatch?.started ?? batchTasks.length}/${batchTotal} · 完成 ${completedCount} · 失败 ${failedBatchCount} · 处理中 ${batchTasks.filter((task) => task.status === 'running' || task.falRecoverable).length}${activeBatch ? ` · 等待 ${waitingCount}` : batchTasks.length < batchTotal ? ` · 未提交 ${batchTotal - batchTasks.length}` : ''}`
            : '生成预览随响应逐步更新；fal 队列任务可在连接中断后恢复'}
        </p>
      </div>
      {activeBatch && <button type="button" onClick={stopBatchPrompts} className="rounded-[10px] border border-[#e4e4ec] bg-white px-4 py-2 text-[13px] font-medium text-[#ef4444] hover:bg-[#fff0f0] dark:border-white/10 dark:bg-gray-900">停止后续提交</button>}
    </div>

    {mode === 'batch' ? <div className="h-2 overflow-hidden rounded-full bg-[#e4e4ec] dark:bg-gray-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="批量完成进度"><div className="h-full rounded-full bg-[#0d99ff] transition-[width]" style={{ width: `${progress}%` }} /></div> : <div className="flex min-h-12 items-center gap-3 rounded-[10px] border border-[#aedcff] bg-[#eaf6ff] px-4 text-[13px] text-[#185a87] dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 6.4M3 16v-5h5" /><path d="M12 7v5l3 2" /></svg>
      <span>{recoveryNotice}</span>
    </div>}

    <div className={mode === 'stream' ? 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]' : ''}>
      <div className="min-w-0">
        <TaskGrid workspace taskIds={visibleTasks.map((task) => task.id)} waitingCount={mode === 'batch' ? waitingCount : 0} waitingStart={activeBatch?.started ?? 0} />
      </div>
      {mode === 'stream' && <aside className="h-fit rounded-[14px] border border-[#e4e4ec] bg-white p-4 dark:border-white/10 dark:bg-gray-900">
        <h3 className="text-base font-bold text-[#18181b] dark:text-gray-100">失败后的处理方式</h3>
        <p className="mt-1 text-xs text-[#5b5b66] dark:text-gray-400">可仅处理失败项，保留已完成结果</p>
        <div className="mt-5 space-y-3">
          {([
            ['new', '新建任务', '保留失败记录，创建新的任务卡'],
            ['overwriteFailed', '覆盖失败项', '沿用原任务位置，只替换失败结果'],
            ['overwriteAll', '覆盖全部', '重新提交本页已结束的任务'],
          ] as const).map(([value, title, detail]) => <button key={value} type="button" onClick={() => setRetryMode(value)} aria-pressed={retryMode === value} className={`flex w-full items-center gap-3 rounded-[10px] border p-3 text-left ${retryMode === value ? 'border-[#0d99ff] bg-[#eaf6ff] dark:bg-blue-500/10' : 'border-[#e4e4ec] hover:border-[#aedcff] dark:border-white/10'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${retryMode === value ? 'border-[#0d99ff] bg-[#0d99ff]' : 'border-[#c8c8d2]'}`}>{retryMode === value && <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="m5 12 5 5L19 7" /></svg>}</span>
            <span><strong className="block text-[13px] font-medium text-[#18181b] dark:text-gray-100">{title}</strong><small className="mt-1 block text-[11px] text-[#777782] dark:text-gray-400">{detail}</small></span>
          </button>)}
        </div>
        <button type="button" onClick={beginRetry} disabled={retrying || (!failedTasks.length && retryMode !== 'overwriteAll')} className="mt-6 w-full rounded-[9px] bg-[#0d99ff] px-3 py-2.5 text-[13px] font-medium text-white hover:bg-[#0a83dc] disabled:cursor-not-allowed disabled:opacity-45">{retrying ? '正在处理…' : retryMode === 'overwriteAll' ? '重新生成已结束任务' : `重试 ${failedTasks.length} 个失败任务`}</button>
        <p className="mt-3 text-center text-[11px] leading-4 text-[#9696a0]">同时最多处理 2 个任务</p>
      </aside>}
    </div>
  </section>
}
