import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

interface HelpModalProps {
  onClose: () => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
        {n}
      </span>
      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{children}</p>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl bg-gray-100/70 p-4 dark:bg-white/[0.04]">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
        <span className="text-blue-500 dark:text-blue-400">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  )
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const isMobile = useIsMobile()
  useCloseOnEscape(true, onClose)

  return createPortal(
    <div
      data-no-drag-select
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-overlay-in" />
      <div
        className="relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900 dark:ring-white/10 rounded-t-2xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 移动端抓手 */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-9 rounded-full bg-gray-300 dark:bg-white/[0.12]" />
        </div>

        {/* 头部 */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-white/[0.08]">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-gray-900 dark:text-gray-100">
            <svg className="h-[18px] w-[18px] text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            操作指南
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.1] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="custom-scrollbar flex-1 space-y-3.5 overflow-y-auto p-5">
          <SectionCard
            title="多选记录"
            icon={
              isMobile ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="m18 8 4 4-4 4M6 8l-4 4 4 4M22 12H2" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M9 9 2 2m0 0 5.5 1.5M2 2l1.5 5.5" />
                  <path d="M14.5 4.5 16 8l3.5 1.5L16 11l-1.5 3.5L13 11l-3.5-1.5L13 8z" />
                  <path d="M21 21l-6-6" />
                </svg>
              )
            }
          >
            <div className="space-y-2.5">
              {isMobile ? (
                <>
                  <Step n={1}>在记录卡片上左右滑动，即可选中或取消选中该卡片</Step>
                  <Step n={2}>连续滑动多张卡片即可快速多选</Step>
                </>
              ) : (
                <>
                  <Step n={1}>在空白处按住鼠标拖拽，框选多张卡片</Step>
                  <Step n={2}>
                    按住 <kbd className="rounded border border-gray-300 bg-white px-1 py-0.5 font-sans text-[11px] text-gray-600 dark:border-white/15 dark:bg-white/10 dark:text-gray-300">Ctrl</kbd>
                    {' / '}
                    <kbd className="rounded border border-gray-300 bg-white px-1 py-0.5 font-sans text-[11px] text-gray-600 dark:border-white/15 dark:bg-white/10 dark:text-gray-300">⌘</kbd> 点击卡片，单独增选或移除
                  </Step>
                  <Step n={3}>再次框选已选中的卡片即可取消选中</Step>
                  <Step n={4}>点击卡片外的空白处，取消全部选择</Step>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="批量操作"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />
              </svg>
            }
          >
            <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              选中记录后，页面底部会出现操作栏，可批量收藏、批量删除，或一键全选当前可见的记录。
            </p>
          </SectionCard>
        </div>

        {/* 底部 */}
        <div className="flex justify-center border-t border-gray-200 px-5 py-3.5 dark:border-white/[0.08]">
          <a
            href="https://github.com/EmmaStoneX/gpt-image-playground"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <svg className="h-[18px] w-[18px] transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            EmmaStoneX
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}
