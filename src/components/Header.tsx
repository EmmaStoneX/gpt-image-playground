import { useState } from 'react'
import { useStore } from '../store'
import { useVersionCheck } from '../hooks/useVersionCheck'
import HelpModal from './HelpModal'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }
  return { dark, toggle }
}

function SegmentedFilter({
  filterFavorite,
  setFilterFavorite,
}: {
  filterFavorite: boolean
  setFilterFavorite: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[10px] border border-gray-200 bg-gray-100/80 p-[3px] dark:border-white/[0.08] dark:bg-white/[0.04]">
      <button
        onClick={() => setFilterFavorite(false)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-all sm:px-3 ${
          !filterFavorite
            ? 'bg-white text-gray-800 shadow-sm dark:bg-white/10 dark:text-gray-100'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
        <span>全部</span>
      </button>
      <button
        onClick={() => setFilterFavorite(true)}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium transition-all sm:px-3 ${
          filterFavorite
            ? 'bg-white text-yellow-500 shadow-sm dark:bg-white/10'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
      >
        <svg className="h-3.5 w-3.5" fill={filterFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        <span>收藏</span>
      </button>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setFilterFavorite = useStore((s) => s.setFilterFavorite)
  const { hasUpdate, latestRelease, dismiss } = useVersionCheck()
  const { dark, toggle } = useTheme()
  const [showHelp, setShowHelp] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const iconBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]'

  return (
    <header
      data-no-drag-select
      className="safe-area-top sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-white/[0.08] dark:bg-gray-900/90"
    >
      {/* 顶栏 */}
      <div className="safe-area-x safe-header-inner mx-auto flex max-w-7xl items-center gap-3 sm:gap-4">
        {/* 左：品牌 + 分段筛选（桌面） */}
        <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
          <a
            href="https://github.com/EmmaStoneX/gpt-image-playground"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-w-0 items-center gap-2.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white shadow-sm transition-colors group-hover:bg-blue-600">
              <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="m14.31 8 5.74 9.94" /><path d="M9.69 8h11.48" /><path d="m7.38 12 5.74-9.94" />
                <path d="M9.69 16 3.95 6.06" /><path d="M14.31 16H2.83" /><path d="m16.62 12-5.74 9.94" />
              </svg>
            </span>
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-gray-800 transition-colors group-hover:text-gray-600 dark:text-gray-100 dark:group-hover:text-gray-300">
              <span className="hidden sm:inline">GPT Image Playground</span>
              <span className="sm:hidden">GPT Image</span>
            </h1>
          </a>
          {hasUpdate && latestRelease && (
            <a
              href={latestRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              className="rounded border border-red-500/30 bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transition-colors animate-fade-in hover:bg-red-600"
              title={`新版本 ${latestRelease.tag}`}
            >
              NEW
            </a>
          )}

          <div className="hidden sm:block">
            <SegmentedFilter filterFavorite={filterFavorite} setFilterFavorite={setFilterFavorite} />
          </div>
        </div>

        {/* 右：搜索 + 操作 */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* 桌面端：展开式搜索框 */}
          <div className="relative hidden sm:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              <SearchIcon />
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder="搜索提示词…"
              className="h-9 w-44 rounded-[10px] bg-gray-100 pl-9 pr-3 text-sm text-gray-700 outline-none transition-[width,box-shadow] placeholder:text-gray-400 focus:w-60 focus:ring-2 focus:ring-blue-500/25 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500"
            />
          </div>

          {/* 移动端：搜索图标按钮 */}
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className={`${iconBtn} sm:hidden ${mobileSearchOpen ? 'bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-200' : ''}`}
            title="搜索"
          >
            <SearchIcon />
          </button>

          <button onClick={() => setShowHelp(true)} className={`${iconBtn} hidden sm:flex`} title="操作指南">
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </button>

          <button onClick={toggle} className={iconBtn} title={dark ? '切换为浅色' : '切换为深色'}>
            {dark ? (
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <button onClick={() => setShowSettings(true)} className={iconBtn} title="设置">
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 移动端第二行：分段筛选 + 可展开搜索 */}
      <div className="safe-area-x flex items-center gap-2 pb-2.5 sm:hidden">
        <SegmentedFilter filterFavorite={filterFavorite} setFilterFavorite={setFilterFavorite} />
        {mobileSearchOpen && (
          <div className="relative min-w-0 flex-1 animate-fade-in">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              <SearchIcon />
            </span>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder="搜索提示词…"
              className="h-9 w-full rounded-[10px] bg-gray-100 pl-9 pr-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/25 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500"
            />
          </div>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </header>
  )
}
