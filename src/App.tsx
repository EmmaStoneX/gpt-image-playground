import { useEffect, useState } from 'react'
import { initStore } from './store'
import { useStore } from './store'
import { normalizeBaseUrl } from './lib/api'
import { normalizeSettings, switchApiProfileProvider } from './lib/apiProfiles'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import type { ApiMode, ApiProvider, AppSettings } from './types'
import Header from './components/Header'
import TaskGrid from './components/TaskGrid'
import TaskWorkspace from './components/TaskWorkspace'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'

export default function App() {
  const setSettings = useStore((s) => s.setSettings)
  const tasks = useStore((s) => s.tasks)
  const batchProgress = useStore((s) => s.batchProgress)
  const [taskView, setTaskView] = useState<'all' | 'batch' | 'stream'>('all')
  const latestBatchId = tasks.reduce((latest, task) => Math.max(latest, task.batchId ?? 0), 0)
  const selectedBatchId = batchProgress?.id ?? latestBatchId
  const hasStreamTasks = taskView === 'stream' || tasks.some((task) => task.status === 'running' || task.status === 'error')
  useDockerApiUrlMigrationNotice()

  useEffect(() => {
    if (batchProgress?.id) setTaskView('batch')
  }, [batchProgress?.id])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const nextSettings: Partial<AppSettings> = {}

    const apiUrlParam = searchParams.get('apiUrl')
    if (apiUrlParam !== null) {
      nextSettings.baseUrl = normalizeBaseUrl(apiUrlParam.trim())
    }

    const apiKeyParam = searchParams.get('apiKey')
    if (apiKeyParam !== null) {
      nextSettings.apiKey = apiKeyParam.trim()
    }

    const codexCliParam = searchParams.get('codexCli')
    if (codexCliParam !== null) {
      nextSettings.codexCli = codexCliParam.trim().toLowerCase() === 'true'
    }

    const apiModeParam = searchParams.get('apiMode')
    if (apiModeParam === 'images' || apiModeParam === 'responses') {
      nextSettings.apiMode = apiModeParam
    }

    const providerParam = searchParams.get('provider')?.trim().toLowerCase()
    if (providerParam) {
      const provider: ApiProvider | null = providerParam === 'fal'
        ? 'fal'
        : ['openai', 'openai-compatible'].includes(providerParam)
          ? 'openai'
          : null
      if (provider) {
        const state = useStore.getState()
        const settings = normalizeSettings(state.settings)
        const current = settings.profiles.find((profile) => profile.id === settings.activeProfileId) ?? settings.profiles[0]
        if (current) {
          nextSettings.profiles = settings.profiles.map((profile) =>
            profile.id === current.id
              ? {
                  ...switchApiProfileProvider(profile, provider),
                  ...(nextSettings.baseUrl !== undefined ? { baseUrl: nextSettings.baseUrl } : {}),
                  ...(nextSettings.apiKey !== undefined ? { apiKey: nextSettings.apiKey } : {}),
                  ...(provider === 'openai' && nextSettings.apiMode !== undefined ? { apiMode: nextSettings.apiMode } : {}),
                  ...(provider === 'openai' && nextSettings.codexCli !== undefined ? { codexCli: nextSettings.codexCli } : {}),
                }
              : profile,
          )
          nextSettings.activeProfileId = current.id
        }
      }
    }

    setSettings(nextSettings)

    if (searchParams.has('apiUrl') || searchParams.has('apiKey') || searchParams.has('codexCli') || searchParams.has('apiMode') || searchParams.has('provider')) {
      searchParams.delete('apiUrl')
      searchParams.delete('apiKey')
      searchParams.delete('codexCli')
      searchParams.delete('apiMode')
      searchParams.delete('provider')

      const nextSearch = searchParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }

    void initStore().then(async () => {
      if (import.meta.env.DEV && searchParams.get('layoutTest') === '1') {
        const { loadLayoutFixtures } = await import('./dev/layoutFixtures')
        await loadLayoutFixtures()
      }
      const uiTest = searchParams.get('uiTest')
      if (import.meta.env.DEV && (uiTest === 'batch' || uiTest === 'stream')) {
        const { loadWorkspaceFixtures } = await import('./dev/layoutFixtures')
        await loadWorkspaceFixtures(uiTest)
        setTaskView(uiTest)
      }
    })
  }, [setSettings])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  return (
    <>
      <Header />
      <main data-home-main data-drag-select-surface className="pb-48">
        <div className="safe-area-x mx-auto max-w-[1344px] pt-6">
          {(selectedBatchId > 0 || hasStreamTasks) && <nav aria-label="任务视图" className="mb-6 flex flex-wrap items-center gap-1 rounded-[10px] border border-[#e4e4ec] bg-white p-1 text-[13px] dark:border-white/10 dark:bg-gray-900 sm:w-fit">
            <button type="button" onClick={() => setTaskView('all')} aria-current={taskView === 'all' ? 'page' : undefined} className={`rounded-[7px] px-3 py-1.5 ${taskView === 'all' ? 'bg-[#eaf6ff] font-medium text-[#087bc0] dark:bg-blue-500/15 dark:text-blue-300' : 'text-[#5b5b66] hover:bg-[#f6f6f9] dark:text-gray-400 dark:hover:bg-white/5'}`}>全部任务</button>
            {selectedBatchId > 0 && <button type="button" onClick={() => setTaskView('batch')} aria-current={taskView === 'batch' ? 'page' : undefined} className={`rounded-[7px] px-3 py-1.5 ${taskView === 'batch' ? 'bg-[#eaf6ff] font-medium text-[#087bc0] dark:bg-blue-500/15 dark:text-blue-300' : 'text-[#5b5b66] hover:bg-[#f6f6f9] dark:text-gray-400 dark:hover:bg-white/5'}`}>批量任务</button>}
            {hasStreamTasks && <button type="button" onClick={() => setTaskView('stream')} aria-current={taskView === 'stream' ? 'page' : undefined} className={`rounded-[7px] px-3 py-1.5 ${taskView === 'stream' ? 'bg-[#eaf6ff] font-medium text-[#087bc0] dark:bg-blue-500/15 dark:text-blue-300' : 'text-[#5b5b66] hover:bg-[#f6f6f9] dark:text-gray-400 dark:hover:bg-white/5'}`}>流式与恢复</button>}
          </nav>}
          {taskView === 'batch' && selectedBatchId > 0 ? <TaskWorkspace mode="batch" batchId={selectedBatchId} /> : taskView === 'stream' && hasStreamTasks ? <TaskWorkspace mode="stream" /> : <TaskGrid />}
        </div>
      </main>
      <InputBar hideBatchProgress={taskView === 'batch' && selectedBatchId > 0} />
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <ConfirmDialog />
      <Toast />
      <MaskEditorModal />
      <ImageContextMenu />
    </>
  )
}
