import { useEffect, useState, useRef } from 'react'
import type { TaskRecord } from '../types'
import { useStore, getCachedImage, ensureImageCached, updateTaskInStore, retryTask } from '../store'
import { formatImageRatio } from '../lib/size'
import { ParamValue } from '../lib/paramDisplay'
import { MobileSafeImage } from './MobileSafeImage'

interface Props {
  task: TaskRecord
  onReuse: () => void
  onEditOutputs: () => void
  onDelete: () => void
  onClick: (e: React.MouseEvent | React.TouchEvent) => void
  isSelected?: boolean
}

export default function TaskCard({
  task,
  onReuse,
  onEditOutputs,
  onDelete,
  onClick,
  isSelected,
}: Props) {
  const [thumbSrc, setThumbSrc] = useState<string>('')
  const [coverRatio, setCoverRatio] = useState<string>('')
  const [coverSize, setCoverSize] = useState<string>('')
  const [now, setNow] = useState(Date.now())
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeStartedSelected, setSwipeStartedSelected] = useState(false)
  const [swipeActionActive, setSwipeActionActive] = useState(false)
  const toggleTaskSelection = useStore((s) => s.toggleTaskSelection)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const swipeResetTimerRef = useRef<number | null>(null)
  const suppressClickUntilRef = useRef(0)
  const horizontalSwipeRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
      swipeResetTimerRef.current = null
    }
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    horizontalSwipeRef.current = false
    setSwipeStartedSelected(Boolean(isSelected))
    setSwipeActionActive(false)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const deltaX = e.touches[0].clientX - touchStartRef.current.x
    const deltaY = e.touches[0].clientY - touchStartRef.current.y
    
    // 如果主要是水平滑动
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      horizontalSwipeRef.current = true
      e.preventDefault()
      // 限制滑动距离，例如最大 60px
      const boundedOffset = Math.max(-60, Math.min(60, deltaX))
      setSwipeOffset(boundedOffset)
      setSwipeActionActive(Math.abs(deltaX) >= 40)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsSwiping(false)
    setSwipeOffset(0)
    
    if (!touchStartRef.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    touchStartRef.current = null
    const isSwipeAction = horizontalSwipeRef.current && Math.abs(deltaX) > 40
    horizontalSwipeRef.current = false
    setSwipeActionActive(isSwipeAction)
    swipeResetTimerRef.current = window.setTimeout(() => {
      setSwipeActionActive(false)
      swipeResetTimerRef.current = null
    }, 220)

    // 如果是水平滑动，且垂直偏移较小，认为是滑动选择
    if (isSwipeAction) {
      suppressClickUntilRef.current = Date.now() + 350
      e.preventDefault()
      e.stopPropagation()
      toggleTaskSelection(task.id)
    }
  }

  const handleTouchCancel = () => {
    touchStartRef.current = null
    horizontalSwipeRef.current = false
    setIsSwiping(false)
    setSwipeOffset(0)
    setSwipeActionActive(false)
  }

  useEffect(() => () => {
    if (swipeResetTimerRef.current != null) {
      window.clearTimeout(swipeResetTimerRef.current)
    }
  }, [])

  // 定时更新运行中任务的计时
  useEffect(() => {
    if (task.status !== 'running' && !(task.status === 'error' && task.falRecoverable)) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    setNow(Date.now())
    return () => clearInterval(id)
  }, [task.falRecoverable, task.status])

  // 加载缩略图
  useEffect(() => {
    setCoverRatio('')
    setCoverSize('')

    if (task.outputImages?.[0]) {
      const cached = getCachedImage(task.outputImages[0])
      if (cached) {
        setThumbSrc(cached)
      } else {
        ensureImageCached(task.outputImages[0]).then((url) => {
          if (url) setThumbSrc(url)
        })
      }
    }
  }, [task.outputImages])

  useEffect(() => {
    if (!thumbSrc) return

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (!cancelled && image.naturalWidth > 0 && image.naturalHeight > 0) {
        setCoverRatio(formatImageRatio(image.naturalWidth, image.naturalHeight))
        setCoverSize(`${image.naturalWidth}×${image.naturalHeight}`)
      }
    }
    image.src = thumbSrc
    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setCoverRatio(formatImageRatio(image.naturalWidth, image.naturalHeight))
      setCoverSize(`${image.naturalWidth}×${image.naturalHeight}`)
    }

    return () => {
      cancelled = true
    }
  }, [thumbSrc])

  const duration = (() => {
    let seconds: number
    if (task.status === 'running' || task.falRecoverable) {
      seconds = Math.floor((now - task.createdAt) / 1000)
    } else if (task.elapsed != null) {
      seconds = Math.floor(task.elapsed / 1000)
    } else {
      return '00:00'
    }
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()
  const aggregateActualParams = task.outputImages?.length
    ? { ...task.actualParams, n: task.outputImages.length }
    : task.actualParams
  const isSwipeReady = Math.abs(swipeOffset) >= 40
  const showSwipeAction = isSwipeReady || swipeActionActive
  const isFalReconnecting = task.status === 'error' && task.falRecoverable
  const showRunningTimer = task.status === 'running' || isFalReconnecting
  const swipeBgClass = showSwipeAction
    ? swipeStartedSelected
      ? 'bg-gray-500 dark:bg-gray-600'
      : 'bg-blue-500'
    : 'bg-gray-200 dark:bg-gray-700'

  const dim = coverSize.match(/(\d+)[×x](\d+)/)
  const aspectRatio = task.status === 'done' && dim ? `${dim[1]} / ${dim[2]}` : '4 / 5'

  const actionBtn = 'flex items-center justify-center w-8 h-8 rounded-lg bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 transition'

  return (
    <div className="relative rounded-xl">
      {/* 侧滑底图 */}
      <div
        className={`absolute inset-0 rounded-xl flex items-center transition-opacity duration-200 pointer-events-none ${
          isSwiping || swipeOffset || swipeActionActive ? 'opacity-100' : 'opacity-0'
        } ${swipeBgClass} ${
          swipeOffset > 0 ? 'justify-start pl-6' : 'justify-end pr-6'
        }`}
      >
        <svg className={`w-8 h-8 transition-transform duration-150 ${showSwipeAction ? 'scale-110 text-white' : 'scale-90 text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {swipeStartedSelected && showSwipeAction ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          )}
        </svg>
      </div>

      <div
        className={`relative rounded-xl border overflow-hidden cursor-pointer group bg-gray-100 dark:bg-white/[0.03] duration-200 ${
          !isSwiping ? 'transition-[box-shadow,border-color,background-color,transform]' : 'transition-[box-shadow,border-color,background-color]'
        } ${
          task.status === 'running'
            ? 'border-blue-400 generating'
            : isSelected
            ? 'border-blue-500 shadow-md ring-2 ring-blue-500/50'
            : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/20 hover:shadow-lg'
        }`}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
          aspectRatio,
        }}
        onClick={(e) => {
          if (Date.now() < suppressClickUntilRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          onClick(e)
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {/* 图片 / 状态 */}
        {task.status === 'done' && thumbSrc && (
          <MobileSafeImage
            src={thumbSrc}
            className="saveable-image absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            alt=""
          />
        )}
        {task.status === 'done' && !thumbSrc && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-9 h-9 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {task.status === 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-gray-400 dark:text-gray-500">生成中…</span>
          </div>
        )}
        {task.status === 'error' && isFalReconnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3">
            <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs text-yellow-500 text-center leading-tight">重连中</span>
          </div>
        )}
        {task.status === 'error' && !isFalReconnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-red-400 text-center leading-tight">生成失败</span>
            <button
              onClick={(e) => { e.stopPropagation(); retryTask(task) }}
              className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重试
            </button>
          </div>
        )}

        {/* 顶部左：比例/分辨率 或 计时 + 数量 */}
        <div className="absolute top-2 left-2 flex items-center gap-1 pointer-events-none">
          {showRunningTimer || task.status !== 'done' || !coverRatio || !coverSize ? (
            <span className="flex items-center gap-1 bg-black/50 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {duration}
            </span>
          ) : (
            <>
              <span className="bg-black/50 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
                {coverRatio}
              </span>
              <span className="bg-black/50 text-white/90 text-[10px] sm:text-xs px-1.5 py-0.5 rounded backdrop-blur-sm font-medium">
                {coverSize}
              </span>
            </>
          )}
          {task.status === 'done' && task.outputImages.length > 1 && (
            <span className="flex items-center gap-0.5 bg-black/50 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded backdrop-blur-sm font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <path d="M7 21h12a2 2 0 002-2V9" />
              </svg>
              {task.outputImages.length}
            </span>
          )}
          {task.maskImageId && (
            <span className="bg-blue-500/90 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded backdrop-blur-sm font-medium tracking-wide">
              MASK
            </span>
          )}
        </div>

        {/* 顶部右：选中标记 / 收藏 */}
        {isSelected ? (
          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-sm pointer-events-none">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); updateTaskInStore(task.id, { isFavorite: !task.isFavorite }) }}
            className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full backdrop-blur-sm transition ${
              task.isFavorite
                ? 'bg-black/35 text-yellow-400 opacity-100'
                : 'bg-black/35 text-white opacity-0 group-hover:opacity-100 hover:text-yellow-300'
            }`}
            title={task.isFavorite ? '取消收藏' : '收藏记录'}
          >
            <svg className="w-4 h-4" fill={task.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        )}

        {/* 底部：提示词 + 操作（悬停浮现，仅完成态） */}
        {task.status === 'done' && (
          <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className="text-white text-xs leading-snug line-clamp-2 mb-2 drop-shadow">
              {task.prompt || '(无提示词)'}
            </p>
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button onClick={onReuse} className={actionBtn} title="复用配置">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button onClick={onEditOutputs} disabled={!task.outputImages?.length} className={`${actionBtn} disabled:opacity-30`} title="编辑输出">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={onDelete} className={`${actionBtn} ml-auto hover:!bg-red-500/80`} title="删除记录">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
