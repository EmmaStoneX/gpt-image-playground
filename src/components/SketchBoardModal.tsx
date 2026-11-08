import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ImageComment, InputImage } from '../types'
import { ensureImageCached, saveInputSketch, useStore } from '../store'
import { loadImage } from '../lib/canvasImage'

type Tool = 'select' | 'pen' | 'eraser' | 'rect' | 'arrow' | 'text' | 'comment'
type Point = { x: number; y: number }

function ToolIcon({ tool }: { tool: Tool }) {
  const paths: Record<Tool, ReactNode> = {
    select: <path d="m5 3 13 9-6 1-2 6-5-16Z" />,
    pen: <><path d="m4 20 4-.8L19 8.2 15.8 5 4.8 16Z" /><path d="m13.8 7 3.2 3.2M4 20h16" /></>,
    arrow: <><path d="M4 19 19 4M10 4h9v9" /></>,
    rect: <rect x="4" y="5" width="16" height="14" rx="2" />,
    text: <><path d="M4 6h16M12 6v13M8 19h8" /></>,
    eraser: <><path d="m4 15 8-10a2 2 0 0 1 3-.2l5 5a2 2 0 0 1 0 2.8L13 20H8l-4-4a1 1 0 0 1 0-1Z" /><path d="m9 10 7 7M13 20h7" /></>,
    comment: <><path d="M20 11a8 8 0 0 1-8 8 9 9 0 0 1-3-.5L4 20l1.5-5A8 8 0 1 1 20 11Z" /><path d="M9 11h6" /></>,
  }
  return <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">{paths[tool]}</svg>
}

export default function SketchBoardModal({ image, onClose }: { image: InputImage; onClose: () => void }) {
  const showToast = useStore((s) => s.showToast)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<Array<{ url: string; hasMarkup: boolean }>>([])
  const drawingRef = useRef<{ start: Point; last: Point; snapshot: ImageData; tool: Tool } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(6)
  const [zoom, setZoom] = useState(1)
  const [comments, setComments] = useState<ImageComment[]>(image.comments ?? [])
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [textPoint, setTextPoint] = useState<Point | null>(null)
  const [textValue, setTextValue] = useState('')
  const [hasMarkup, setHasMarkup] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pendingPoint) setPendingPoint(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pendingPoint, onClose])

  useEffect(() => {
    let cancelled = false
    loadImage(image.dataUrl).then(async (loaded) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = loaded.naturalWidth
      canvas.height = loaded.naturalHeight
      setSize({ width: canvas.width, height: canvas.height })
      if (!image.markupImageId) return
      const overlayUrl = await ensureImageCached(image.markupImageId)
      if (!overlayUrl || cancelled) return
      const overlay = await loadImage(overlayUrl)
      if (cancelled) return
      canvas.getContext('2d')?.drawImage(overlay, 0, 0, canvas.width, canvas.height)
      setHasMarkup(true)
    }).catch((error) => showToast(error instanceof Error ? error.message : String(error), 'error'))
    return () => { cancelled = true }
  }, [image.id, image.dataUrl, image.markupImageId, showToast])

  const fit = size.width && size.height
    ? Math.min(1, Math.max(260, window.innerWidth - 590) / size.width, Math.max(280, window.innerHeight - 230) / size.height)
    : 1
  const displayWidth = size.width * fit * zoom
  const displayHeight = size.height * fit * zoom

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * size.width, y: ((event.clientY - rect.top) / rect.height) * size.height }
  }

  const pushUndo = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    historyRef.current = [...historyRef.current.slice(-14), { url: canvas.toDataURL('image/png'), hasMarkup }]
    setUndoCount(historyRef.current.length)
  }

  const drawShape = (ctx: CanvasRenderingContext2D, from: Point, to: Point, shape: Tool) => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (shape === 'rect') ctx.rect(from.x, from.y, to.x - from.x, to.y - from.y)
    else {
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
    }
    ctx.stroke()
    if (shape === 'arrow') {
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      const length = Math.max(14, strokeWidth * 4)
      ctx.beginPath()
      ctx.moveTo(to.x, to.y)
      ctx.lineTo(to.x - length * Math.cos(angle - Math.PI / 6), to.y - length * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(to.x - length * Math.cos(angle + Math.PI / 6), to.y - length * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!size.width || !size.height) return
    const point = getPoint(event)
    if (tool === 'comment') {
      setPendingPoint(point)
      return
    }
    if (tool === 'select') return
    if (tool === 'text') { setTextPoint(point); setTextValue(''); return }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    pushUndo()
    drawingRef.current = { start: point, last: point, snapshot: ctx.getImageData(0, 0, canvas.width, canvas.height), tool }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (tool === 'pen' || tool === 'eraser') {
      ctx.save()
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
      ctx.strokeStyle = color
      ctx.lineWidth = tool === 'eraser' ? strokeWidth * 3 : strokeWidth
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
      ctx.lineTo(point.x + 0.1, point.y + 0.1)
      ctx.stroke()
      ctx.restore()
    }
    setHasMarkup(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!drawing || !ctx) return
    const point = getPoint(event)
    if (drawing.tool === 'pen' || drawing.tool === 'eraser') {
      ctx.save()
      ctx.globalCompositeOperation = drawing.tool === 'eraser' ? 'destination-out' : 'source-over'
      ctx.strokeStyle = color
      ctx.lineWidth = drawing.tool === 'eraser' ? strokeWidth * 3 : strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(drawing.last.x, drawing.last.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      ctx.restore()
    } else {
      ctx.putImageData(drawing.snapshot, 0, 0)
      drawShape(ctx, drawing.start, point, drawing.tool)
    }
    drawing.last = point
  }

  const onPointerUp = () => { drawingRef.current = null }

  const addText = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !textPoint || !textValue.trim()) return
    pushUndo()
    ctx.save()
    ctx.fillStyle = color
    ctx.font = `${Math.max(18, strokeWidth * 5)}px system-ui, sans-serif`
    ctx.fillText(textValue.trim(), textPoint.x, textPoint.y)
    ctx.restore()
    setHasMarkup(true)
    setTextPoint(null)
  }

  const undo = async () => {
    const entry = historyRef.current.pop()
    const canvas = canvasRef.current
    if (!entry || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const overlayImage = await loadImage(entry.url)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(overlayImage, 0, 0)
    setUndoCount(historyRef.current.length)
    setHasMarkup(entry.hasMarkup)
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveInputSketch(image.id, hasMarkup ? canvasRef.current?.toDataURL('image/png') ?? null : null, comments.filter((comment) => comment.text.trim()))
      onClose()
    } catch (error) {
      showToast(`保存画板失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally { setSaving(false) }
  }

  const addComment = () => {
    if (!commentDraft.trim() || !size.width || !size.height) return
    const point = pendingPoint ?? { x: size.width / 2, y: size.height / 2 }
    const comment = { id: crypto.randomUUID(), x: point.x / size.width, y: point.y / size.height, text: commentDraft.trim() }
    setComments((items) => [...items, comment])
    setSelectedCommentId(comment.id)
    setPendingPoint(null)
    setCommentDraft('')
  }

  const toolLabels: Array<[Tool, string]> = [['select', '选择'], ['pen', '画笔'], ['arrow', '箭头'], ['rect', '矩形'], ['text', '文字'], ['eraser', '橡皮'], ['comment', '评论']]
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-3 text-[#18181b] sm:p-6" data-no-drag-select>
    <div className="flex h-[min(830px,calc(100vh-48px))] w-full max-w-[1304px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <header className="flex h-[60px] shrink-0 items-center gap-3 px-6">
        <strong className="whitespace-nowrap text-base font-bold">画板与评论</strong>
        <span className="min-w-0 truncate text-xs text-[#71717a]">参考图片 · {size.width || '…'} × {size.height || '…'}</span>
        <button onClick={() => void save()} disabled={saving} className="ml-auto h-9 w-[92px] shrink-0 rounded-[9px] bg-[#0d99ff] text-[13px] font-medium text-white hover:bg-[#0a83dc] disabled:opacity-50">{saving ? '保存中…' : '完成'}</button>
        <button onClick={onClose} aria-label="关闭画板" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-[#e4e4e7] text-[#71717a] hover:bg-[#fafafa]"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" viewBox="0 0 24 24"><path d="M5 5 19 19M19 5 5 19" /></svg></button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pb-[26px] pt-[18px] md:flex-row">
        <div className="flex shrink-0 gap-3 overflow-x-auto rounded-xl border border-[#e4e4e7] bg-white p-[7px] md:w-[52px] md:self-start md:flex-col md:gap-5 md:overflow-visible">
          {toolLabels.map(([value, label]) => <button key={value} title={label} aria-label={label} aria-pressed={tool === value} onClick={() => setTool(value)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${tool === value ? 'border border-[#0d99ff] bg-[#e0f2fe] text-[#0a6fe0]' : 'text-[#71717a] hover:bg-[#f4f4f5]'}`}><ToolIcon tool={value} /></button>)}
          <input type="color" aria-label="画笔颜色" title="画笔颜色" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-[9px] border-0 bg-transparent p-1" />
        </div>
        <div className="relative flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-[#f4f4f5]">
          <div className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-sm" style={{ width: displayWidth || 1, height: displayHeight || 1 }}>
            <img src={image.dataUrl} alt="待标注图片" className="absolute inset-0 h-full w-full" draggable={false} />
            <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none', cursor: tool === 'comment' ? 'crosshair' : tool === 'select' ? 'default' : 'crosshair' }} />
            {comments.map((comment, index) => <span key={comment.id} className={`pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white text-xs font-bold text-white shadow ${selectedCommentId === comment.id ? 'bg-[#ef4444]' : 'bg-[#0d99ff]'}`} style={{ left: `${comment.x * 100}%`, top: `${comment.y * 100}%` }}>{index + 1}</span>)}
            {pendingPoint && <span className="pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#ef4444] text-xs font-bold text-white shadow" style={{ left: `${(pendingPoint.x / size.width) * 100}%`, top: `${(pendingPoint.y / size.height) * 100}%` }}>{comments.length + 1}</span>}
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white/95 p-1 text-xs text-[#71717a] shadow-sm">
            <button onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="缩小画布" className="h-7 w-7 rounded hover:bg-[#f4f4f5]">−</button><span className="min-w-9 text-center">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="放大画布" className="h-7 w-7 rounded hover:bg-[#f4f4f5]">＋</button>
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white/95 p-1 text-xs text-[#71717a] shadow-sm">
            <label className="flex items-center gap-1 px-1">粗细 <input type="range" min={2} max={30} value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} className="w-16 accent-[#0d99ff]" /></label>
            <button onClick={() => void undo()} disabled={!undoCount} className="rounded px-2 py-1.5 hover:bg-[#f4f4f5] disabled:opacity-40">撤销</button>
            <button onClick={() => { pushUndo(); canvasRef.current?.getContext('2d')?.clearRect(0, 0, size.width, size.height); setHasMarkup(false) }} className="rounded px-2 py-1.5 hover:bg-[#f4f4f5]">清空</button>
          </div>
        </div>
        <aside className="flex min-h-[240px] w-full shrink-0 flex-col rounded-xl border border-[#e4e4e7] bg-white p-[11px] md:w-[340px]">
          <div className="flex items-center justify-between px-[5px] pb-4 pt-1">
            <h3 className="text-[15px] font-bold">评论与标注</h3>
            <span className="rounded-lg border border-[#0d99ff] px-3 py-1 text-[11px] font-medium text-[#0d99ff]">{comments.length} 条</span>
          </div>
          <div className="min-h-0 flex-1 space-y-[18px] overflow-auto">
            {textPoint && <div className="rounded-[10px] border border-[#0d99ff] p-3 text-xs"><label>文字内容<input autoFocus value={textValue} onChange={(event) => setTextValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addText() }} className="mt-2 w-full rounded-lg border border-[#e4e4e7] px-2 py-1.5 outline-none" /></label><button onClick={addText} className="mt-2 rounded-lg bg-[#0d99ff] px-3 py-1.5 text-white">添加文字</button></div>}
            {comments.length === 0 && <p className="px-2 py-6 text-center text-xs text-[#a1a1aa]">选择评论工具，在图片上点击放置标记。</p>}
            {comments.map((comment, index) => <div key={comment.id} onClick={() => setSelectedCommentId(comment.id)} className={`min-h-[132px] rounded-[10px] border p-[11px] ${selectedCommentId === comment.id ? 'border-[#bfdbfe] bg-[#eff6ff]' : 'border-[#e4e4e7] bg-[#fafafa]'}`}>
              <div className="flex items-center gap-3"><span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-bold text-white ${selectedCommentId === comment.id ? 'bg-[#ef4444]' : 'bg-[#0d99ff]'}`}>{index + 1}</span><span className="text-xs font-medium">你</span><span className="ml-auto text-[10px] text-[#a1a1aa]">{Math.round(comment.x * 100)}%, {Math.round(comment.y * 100)}%</span></div>
              <textarea value={comment.text} onChange={(event) => setComments((items) => items.map((item) => item.id === comment.id ? { ...item, text: event.target.value } : item))} rows={2} aria-label={`第 ${index + 1} 条评论`} className="mt-3 w-full resize-none bg-transparent px-1 text-xs leading-5 outline-none" />
              <div className="text-right"><button onClick={(event) => { event.stopPropagation(); setComments((items) => items.filter((item) => item.id !== comment.id)) }} className="text-[11px] font-medium text-[#ef4444]">删除</button></div>
            </div>)}
          </div>
          <div className="mt-4 rounded-[10px] border border-[#0d99ff] p-[11px]">
            <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) addComment() }} rows={2} placeholder={pendingPoint ? '描述这个标记的修改建议…' : '添加评论，或在画板上点击放置标记…'} className="w-full resize-none text-xs outline-none placeholder:text-[#a1a1aa]" />
            <div className="flex justify-end"><button onClick={addComment} disabled={!commentDraft.trim()} className="h-8 w-[72px] rounded-lg bg-[#0d99ff] text-xs font-medium text-white disabled:opacity-50">发送</button></div>
          </div>
          <p className="px-[5px] pt-7 text-[11px] text-[#a1a1aa]">⌘↵ 发送 · Esc 取消标记</p>
        </aside>
      </div>
    </div>
  </div>
}
