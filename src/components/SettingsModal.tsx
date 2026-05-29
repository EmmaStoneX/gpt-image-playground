import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react'
import { normalizeBaseUrl } from '../lib/api'
import { isApiProxyAvailable, readClientDevProxyConfig } from '../lib/devProxy'
import { useStore, exportData, importData, clearAllData } from '../store'
import {
  createDefaultOpenAIProfile,
  DEFAULT_FAL_BASE_URL,
  DEFAULT_FAL_MODEL,
  DEFAULT_IMAGES_MODEL,
  DEFAULT_OPENAI_PROFILE_ID,
  DEFAULT_RESPONSES_MODEL,
  DEFAULT_SETTINGS,
  getActiveApiProfile,
  normalizeSettings,
  switchApiProfileProvider,
} from '../lib/apiProfiles'
import type { ApiProfile, AppSettings } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { useVersionCheck } from '../hooks/useVersionCheck'
import Select from './Select'

const REPO_URL = 'https://github.com/EmmaStoneX/gpt-image-playground'

type SettingsTab = 'api' | 'defaults' | 'data' | 'about'

const TABS: { id: SettingsTab; label: string; icon: ReactElement }[] = [
  {
    id: 'api',
    label: 'API 配置',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    id: 'defaults',
    label: '生成默认值',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'data',
    label: '数据管理',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
      </svg>
    ),
  },
  {
    id: 'about',
    label: '关于',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
      </svg>
    ),
  },
]

const SIZE_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '1024×1024 (方)', value: '1024x1024' },
  { label: '1536×1024 (横)', value: '1536x1024' },
  { label: '1024×1536 (竖)', value: '1024x1536' },
]
const QUALITY_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]
const FORMAT_OPTIONS = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' },
]
const MODERATION_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '宽松', value: 'low' },
]

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function providerLabel(provider: string) {
  return provider === 'fal' ? 'fal.ai' : 'OpenAI'
}

export default function SettingsModal() {
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const importInputRef = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState<AppSettings>(normalizeSettings(settings))
  const [timeoutInput, setTimeoutInput] = useState(String(getActiveApiProfile(settings).timeout))
  const [showApiKey, setShowApiKey] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('api')
  const params = useStore((s) => s.params)
  const setParams = useStore((s) => s.setParams)
  const tasks = useStore((s) => s.tasks)
  const { latestRelease } = useVersionCheck()

  const apiProxyAvailable = isApiProxyAvailable(readClientDevProxyConfig())
  const activeProfile = draft.profiles.find((profile) => profile.id === draft.activeProfileId) ?? draft.profiles[0] ?? getActiveApiProfile(draft)
  const apiProxyEnabled = apiProxyAvailable && activeProfile.provider === 'openai' && activeProfile.apiProxy

  const getDefaultModelForMode = (apiMode: AppSettings['apiMode']) =>
    apiMode === 'responses' ? DEFAULT_RESPONSES_MODEL : DEFAULT_IMAGES_MODEL

  const wasSettingsOpenRef = useRef(false)

  useEffect(() => {
    if (!showSettings) {
      wasSettingsOpenRef.current = false
      return
    }
    if (wasSettingsOpenRef.current) return

    wasSettingsOpenRef.current = true
    const nextDraft = normalizeSettings(apiProxyAvailable ? settings : {
      ...settings,
      profiles: settings.profiles.map((profile) => ({ ...profile, apiProxy: false })),
    })
    setDraft(nextDraft)
    setTimeoutInput(String(getActiveApiProfile(nextDraft).timeout))
  }, [apiProxyAvailable, showSettings, settings])

  useEffect(() => {
    setTimeoutInput(String(activeProfile.timeout))
  }, [activeProfile.id, activeProfile.timeout])

  const commitSettings = (nextDraft: AppSettings) => {
    const normalizedProfiles = nextDraft.profiles.map((profile) => {
      const normalizedBaseUrl = profile.provider === 'fal'
        ? profile.baseUrl.trim().replace(/\/+$/, '') || DEFAULT_FAL_BASE_URL
        : normalizeBaseUrl(profile.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl)
      const defaultModel = profile.provider === 'fal' ? DEFAULT_FAL_MODEL : getDefaultModelForMode(profile.apiMode)
      return {
        ...profile,
        name: profile.name.trim() || (profile.id === DEFAULT_OPENAI_PROFILE_ID ? '默认' : '新配置'),
        baseUrl: normalizedBaseUrl,
        model: profile.model.trim() || defaultModel,
        timeout: Number(profile.timeout) || DEFAULT_SETTINGS.timeout,
        apiProxy: profile.provider === 'openai' && apiProxyAvailable ? profile.apiProxy : false,
        codexCli: profile.provider === 'openai' ? profile.codexCli : false,
      }
    })
    const fallbackProfile = createDefaultOpenAIProfile({ id: newId('openai') })
    const normalizedDraft = normalizeSettings({
      ...nextDraft,
      profiles: normalizedProfiles.length ? normalizedProfiles : [fallbackProfile],
      activeProfileId: normalizedProfiles.some((profile) => profile.id === nextDraft.activeProfileId)
        ? nextDraft.activeProfileId
        : (normalizedProfiles[0]?.id ?? fallbackProfile.id),
    })
    setDraft(normalizedDraft)
    setSettings(normalizedDraft)
  }

  const getDraftWithActiveProfilePatch = (patch: Partial<ApiProfile>) => ({
      ...draft,
      profiles: draft.profiles.map((profile) => profile.id === activeProfile.id ? { ...profile, ...patch } : profile),
    })

  const updateActiveProfile = (patch: Partial<ApiProfile>, commit = false) => {
    const nextDraft = getDraftWithActiveProfilePatch(patch)
    setDraft(nextDraft)
    if (commit) commitSettings(nextDraft)
  }

  const commitActiveProfilePatch = (patch: Partial<ApiProfile>) => {
    const nextDraft = getDraftWithActiveProfilePatch(patch)
    commitSettings(nextDraft)
  }

  const handleClose = () => {
    const nextTimeout = Number(timeoutInput)
    const normalizedTimeout =
      timeoutInput.trim() === '' || Number.isNaN(nextTimeout)
        ? DEFAULT_SETTINGS.timeout
        : nextTimeout
    const nextDraft = {
      ...draft,
      profiles: activeProfile.provider === 'openai'
        ? draft.profiles.map((profile) =>
            profile.id === activeProfile.id ? { ...profile, timeout: normalizedTimeout } : profile,
          )
        : draft.profiles,
    }
    commitSettings(nextDraft)
    setShowSettings(false)
  }

  const commitTimeout = useCallback(() => {
    if (activeProfile.provider !== 'openai') return
    const nextTimeout = Number(timeoutInput)
    const normalizedTimeout =
      timeoutInput.trim() === '' ? DEFAULT_SETTINGS.timeout : Number.isNaN(nextTimeout) ? activeProfile.timeout : nextTimeout
    setTimeoutInput(String(normalizedTimeout))
    updateActiveProfile({ timeout: normalizedTimeout }, true)
  }, [draft, activeProfile.id, activeProfile.provider, activeProfile.timeout, timeoutInput])

  useCloseOnEscape(showSettings, handleClose)

  if (!showSettings) return null

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const imported = await importData(file)
      if (imported) {
        const nextDraft = normalizeSettings(useStore.getState().settings)
        setDraft(nextDraft)
        setTimeoutInput(String(getActiveApiProfile(nextDraft).timeout))
        setShowProfileMenu(false)
      }
    }
    e.target.value = ''
  }

  const handleClearAllData = async () => {
    await clearAllData()
    const nextDraft = normalizeSettings(useStore.getState().settings)
    setDraft(nextDraft)
    setTimeoutInput(String(getActiveApiProfile(nextDraft).timeout))
    setShowProfileMenu(false)
  }

  const createNewProfile = () => {
    const profile = createDefaultOpenAIProfile({ id: newId('openai'), name: '新配置' })
    const nextDraft = normalizeSettings({
        ...draft,
        profiles: [...draft.profiles, profile],
        activeProfileId: profile.id
    })
    commitSettings(nextDraft)
    setShowProfileMenu(false)
  }

  const switchProfile = (id: string) => {
    const nextDraft = normalizeSettings({ ...draft, activeProfileId: id })
    setDraft(nextDraft)
    setShowProfileMenu(false)
  }

  const deleteProfile = (id: string) => {
    if (draft.profiles.length <= 1) return
    const nextProfiles = draft.profiles.filter((item) => item.id !== id)
    const nextDraft = normalizeSettings({
      ...draft,
      profiles: nextProfiles,
      activeProfileId: draft.activeProfileId === id ? nextProfiles[0].id : draft.activeProfileId,
    })
    commitSettings(nextDraft)
  }

  const fieldCls = 'w-full rounded-lg border border-gray-200/70 bg-white/60 px-3 py-1.5 text-[13px] text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50'
  const labelCls = 'mb-0.5 block text-xs font-semibold text-gray-500 dark:text-gray-400'
  const apiMode = activeProfile.apiMode ?? DEFAULT_SETTINGS.apiMode

  const renderSwitchCard = (
    title: string,
    desc: string,
    checked: boolean,
    onToggle: () => void,
  ) => (
    <div className="flex h-full items-center justify-between gap-2 rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-tight text-gray-700 dark:text-gray-200">{title}</span>
        <span className="block truncate text-[10px] leading-tight text-gray-400 dark:text-gray-500">{desc}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
      </button>
    </div>
  )

  const imageCount = tasks.reduce((acc, t) => acc + (t.outputImages?.length || 0), 0)
  const recordCount = tasks.length

  const closeBtn = (
    <button
      onClick={handleClose}
      className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
      aria-label="关闭"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )

  const listRow = (
    key: string,
    icon: ReactElement,
    title: string,
    subtitle: string,
    onClick: () => void,
    danger = false,
  ) => (
    <button
      key={key}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
        danger
          ? 'border-red-200/80 bg-red-50/50 hover:bg-red-100/70 dark:border-red-500/20 dark:bg-red-500/10 dark:hover:bg-red-500/20'
          : 'border-gray-200/70 bg-white/60 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        danger ? 'bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-400' : 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
      }`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>{title}</span>
        <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{subtitle}</span>
      </span>
      <svg className={`h-4 w-4 shrink-0 ${danger ? 'text-red-300 dark:text-red-500/50' : 'text-gray-300 dark:text-gray-600'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )

  const tabTitle = TABS.find((t) => t.id === tab)?.label ?? ''

  return (
    <div data-no-drag-select className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" onClick={handleClose} />
      <div className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/50 bg-white shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900 dark:ring-white/10 sm:rounded-2xl sm:h-[600px] sm:max-h-[88vh] sm:flex-row max-h-[92dvh]">

        {/* 桌面侧边栏 */}
        <div className="hidden shrink-0 flex-col gap-1 border-r border-gray-200 bg-gray-50/80 p-3 dark:border-white/[0.08] dark:bg-white/[0.02] sm:flex sm:w-52">
          <div className="flex items-center gap-2 px-2 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span className="text-base font-semibold text-gray-800 dark:text-gray-100">设置</span>
          </div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <span className="mt-auto px-3 pt-2 font-mono text-[10px] text-gray-400 dark:text-gray-600 select-none">v{__APP_VERSION__}</span>
        </div>

        {/* 内容区 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 移动端头部 + 标签 */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">设置</h3>
              {closeBtn}
            </div>
            <div className="flex gap-1 overflow-x-auto hide-scrollbar px-4 pb-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    tab === t.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 桌面端内容标题 */}
          <div className="hidden items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/[0.08] sm:flex">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{tabTitle}</h3>
            {closeBtn}
          </div>

          <div className={`flex-1 custom-scrollbar px-4 py-3 sm:px-6 sm:py-4 ${tab === 'api' ? 'overflow-hidden sm:overflow-y-auto' : 'overflow-y-auto'}`}>
            {tab === 'api' && (
              <div className="space-y-2.5">
                {/* 配置方案 */}
                <div className="flex items-end gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span className={labelCls}>配置方案</span>
                    <button
                      type="button"
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex h-[34px] w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200/70 bg-white/60 px-3 text-[13px] text-gray-700 outline-none transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]"
                      title={activeProfile.name}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate">{activeProfile.name}</span>
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                          {providerLabel(activeProfile.provider)}
                        </span>
                      </span>
                      <svg className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showProfileMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl animate-dropdown-down dark:border-white/[0.08] dark:bg-gray-900/95 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] dark:ring-white/10 custom-scrollbar">
                          {draft.profiles.map(profile => (
                            <div
                              key={profile.id}
                              title={profile.name}
                              className={`group flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs transition-colors ${profile.id === activeProfile.id ? 'bg-blue-50 font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.06]'}`}
                            >
                              <button
                                type="button"
                                onClick={() => switchProfile(profile.id)}
                                className="flex min-w-0 flex-1 items-center gap-2 pr-2"
                              >
                                <span className="min-w-0 truncate">{profile.name}</span>
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${profile.id === activeProfile.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.08] dark:text-gray-400'}`}>
                                  {providerLabel(profile.provider)}
                                </span>
                              </button>
                              {draft.profiles.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setConfirmDialog({
                                      title: '删除配置',
                                      message: `确定要删除配置「${profile.name}」吗？`,
                                      action: () => deleteProfile(profile.id)
                                    })
                                  }}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 opacity-60 transition-all hover:bg-red-50 hover:text-red-500 hover:opacity-100 dark:hover:bg-red-500/10"
                                  aria-label="删除配置"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={createNewProfile}
                    className="flex h-[34px] shrink-0 items-center gap-1 rounded-lg border border-gray-200/70 bg-white/60 px-3 text-[13px] font-medium text-blue-600 transition hover:bg-blue-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-blue-400 dark:hover:bg-blue-500/10"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    新增
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block min-w-0">
                    <span className={labelCls}>配置名称</span>
                    <input
                      value={activeProfile.name}
                      onChange={(e) => updateActiveProfile({ name: e.target.value })}
                      onBlur={(e) => commitActiveProfilePatch({ name: e.target.value })}
                      type="text"
                      className={fieldCls}
                    />
                  </label>

                  <div className="block min-w-0">
                    <span className={labelCls}>提供商</span>
                    <div className="flex h-[34px] gap-1 rounded-lg border border-gray-200/70 bg-gray-100/70 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
                      {([['openai', 'OpenAI'], ['fal', 'fal.ai']] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateActiveProfile(switchApiProfileProvider(activeProfile, val), true)}
                          className={`flex-1 rounded-md text-[13px] font-medium transition ${
                            activeProfile.provider === val
                              ? 'bg-white text-blue-600 shadow-sm dark:bg-white/10 dark:text-blue-400'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {activeProfile.provider === 'openai' && (
                  <label className="block">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">API 地址</span>
                      <div
                        onClick={(e) => {
                          e.preventDefault()
                          updateActiveProfile({ codexCli: !activeProfile.codexCli }, true)
                        }}
                        className="flex cursor-pointer items-center gap-1.5"
                        role="switch"
                        aria-checked={activeProfile.codexCli}
                      >
                        <span className={`text-[10px] transition-colors ${activeProfile.codexCli ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>Codex CLI</span>
                        <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${activeProfile.codexCli ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${activeProfile.codexCli ? 'translate-x-[11px]' : 'translate-x-[2px]'}`} />
                        </span>
                      </div>
                    </div>
                    <input
                      value={activeProfile.baseUrl}
                      onChange={(e) => updateActiveProfile({ baseUrl: e.target.value })}
                      onBlur={(e) => commitActiveProfilePatch({ baseUrl: e.target.value })}
                      type="text"
                      disabled={apiProxyEnabled}
                      placeholder={DEFAULT_SETTINGS.baseUrl}
                      className={`${fieldCls} ${apiProxyEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {apiProxyEnabled ? (
                      <div data-selectable-text className="mt-0.5 text-[10px] leading-tight text-yellow-600 dark:text-yellow-500">
                        已开启代理，实际请求目标由部署端决定，此处设置被忽略。
                      </div>
                    ) : (
                      <div data-selectable-text className="mt-0.5 hidden text-[10px] leading-tight text-gray-400 dark:text-gray-500 sm:block">
                        支持通过查询参数覆盖：<code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-white/[0.06]">?apiUrl=</code>，<code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-white/[0.06]">codexCli=true</code>
                      </div>
                    )}
                  </label>
                )}

                <div className="block">
                  <span className={labelCls}>API 密钥</span>
                  <div className="relative">
                    <input
                      value={activeProfile.apiKey}
                      onChange={(e) => updateActiveProfile({ apiKey: e.target.value })}
                      onBlur={(e) => commitActiveProfilePatch({ apiKey: e.target.value })}
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={activeProfile.provider === 'fal' ? 'FAL_KEY' : 'sk-...'}
                      className={`${fieldCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showApiKey ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div data-selectable-text className="mt-0.5 hidden text-[10px] leading-tight text-gray-400 dark:text-gray-500 sm:block">
                    支持通过查询参数覆盖：<code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-white/[0.06]">?apiKey=</code>
                  </div>
                </div>

                {activeProfile.provider === 'openai' && (
                  <label className="block">
                    <span className={labelCls}>API 接口</span>
                    <Select
                      value={apiMode}
                      onChange={(value) => {
                        const nextApiMode = value as AppSettings['apiMode']
                        const nextModel =
                          activeProfile.model === DEFAULT_IMAGES_MODEL || activeProfile.model === DEFAULT_RESPONSES_MODEL
                            ? getDefaultModelForMode(nextApiMode)
                            : activeProfile.model
                        updateActiveProfile({ apiMode: nextApiMode, model: nextModel }, true)
                      }}
                      options={[
                        { label: 'Images API (/v1/images)', value: 'images' },
                        { label: 'Responses API (/v1/responses)', value: 'responses' },
                      ]}
                      className={fieldCls}
                    />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <label className={`block min-w-0 ${activeProfile.provider !== 'openai' ? 'col-span-2' : ''}`}>
                    <span className={labelCls}>模型 ID</span>
                    <input
                      value={activeProfile.model}
                      onChange={(e) => updateActiveProfile({ model: e.target.value })}
                      onBlur={(e) => commitActiveProfilePatch({ model: e.target.value })}
                      type="text"
                      placeholder={activeProfile.provider === 'fal' ? DEFAULT_FAL_MODEL : getDefaultModelForMode(apiMode)}
                      className={fieldCls}
                    />
                  </label>
                  {activeProfile.provider === 'openai' ? (
                    <label className="block min-w-0">
                      <span className={labelCls}>超时 (秒)</span>
                      <input
                        value={timeoutInput}
                        onChange={(e) => setTimeoutInput(e.target.value)}
                        onBlur={commitTimeout}
                        type="number"
                        min={10}
                        max={600}
                        className={fieldCls}
                      />
                    </label>
                  ) : (
                    <div className="hidden sm:block" aria-hidden />
                  )}
                </div>

                <div className={`grid gap-2.5 ${apiProxyAvailable && activeProfile.provider === 'openai' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {apiProxyAvailable && activeProfile.provider === 'openai' && renderSwitchCard(
                    '通过代理请求',
                    '开启后 API 地址被忽略',
                    activeProfile.apiProxy,
                    () => updateActiveProfile({ apiProxy: !activeProfile.apiProxy }, true),
                  )}
                  {renderSwitchCard(
                    '提交后清空输入',
                    '成功后清空输入',
                    draft.clearInputAfterSubmit,
                    () => commitSettings({ ...draft, clearInputAfterSubmit: !draft.clearInputAfterSubmit }),
                  )}
                </div>
              </div>
            )}

            {tab === 'defaults' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 dark:text-gray-500">新建生成时默认使用以下参数，可在输入栏临时调整。</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelCls}>默认尺寸</span>
                    <Select value={params.size} onChange={(v) => setParams({ size: v })} options={SIZE_OPTIONS} className={fieldCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>默认质量</span>
                    <Select value={params.quality} onChange={(v) => setParams({ quality: v as any })} options={QUALITY_OPTIONS} className={fieldCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>输出格式</span>
                    <Select value={params.output_format} onChange={(v) => setParams({ output_format: v as any })} options={FORMAT_OPTIONS} className={fieldCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>压缩质量</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={params.output_format === 'png'}
                      value={params.output_compression ?? ''}
                      placeholder={params.output_format === 'png' ? '不适用' : '自动'}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        setParams({ output_compression: v === '' ? null : Math.max(0, Math.min(100, Number(v) || 0)) })
                      }}
                      className={`${fieldCls} ${params.output_format === 'png' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>安全审核</span>
                    <Select value={params.moderation} onChange={(v) => setParams({ moderation: v as any })} options={MODERATION_OPTIONS} className={fieldCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>默认数量</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={params.n}
                      onChange={(e) => setParams({ n: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                      className={fieldCls}
                    />
                  </label>
                </div>
              </div>
            )}

            {tab === 'data' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-gray-200/70 bg-gray-50/70 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-sm text-gray-400 dark:text-gray-500">本地存储用量</div>
                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {imageCount} 张图片 · {recordCount} 条记录
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {listRow(
                    'export',
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                    '导出全部数据',
                    '将任务记录、图片与配置打包为 ZIP',
                    () => exportData(),
                  )}
                  {listRow(
                    'import',
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
                    '导入数据',
                    '从 ZIP 文件恢复数据',
                    () => importInputRef.current?.click(),
                  )}
                  {listRow(
                    'clear',
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                    '清空全部数据',
                    '删除所有记录、图片与配置，不可恢复',
                    () => setConfirmDialog({
                      title: '清空所有数据',
                      message: '确定要清空所有任务记录、图片数据和供应商配置吗？此操作不可恢复。',
                      action: () => handleClearAllData(),
                    }),
                    true,
                  )}
                  <input ref={importInputRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
                </div>
              </div>
            )}

            {tab === 'about' && (
              <div className="flex flex-col items-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" /><path d="m14.31 8 5.74 9.94" /><path d="M9.69 8h11.48" /><path d="m7.38 12 5.74-9.94" /><path d="M9.69 16 3.95 6.06" /><path d="M14.31 16H2.83" /><path d="m16.62 12-5.74 9.94" />
                  </svg>
                </span>
                <h4 className="mt-4 text-lg font-bold text-gray-800 dark:text-gray-100">GPT Image Playground</h4>
                <span className="mt-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">v{__APP_VERSION__}</span>
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                  一个简洁、强大的 GPT 图像生成工具，支持多供应商、参考图编辑、遮罩绘制与本地化数据管理。
                </p>
                <div className="mt-5 w-full space-y-2">
                  {listRow(
                    'github',
                    <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17a10.9 10.9 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.63 1.59.24 2.76.12 3.05.74.8 1.18 1.82 1.18 3.07 0 4.41-2.69 5.37-5.25 5.66.42.36.79 1.08.79 2.18v3.23c0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5z" /></svg>,
                    'GitHub 仓库',
                    'EmmaStoneX/gpt-image-playground',
                    () => window.open(REPO_URL, '_blank', 'noopener'),
                  )}
                  {listRow(
                    'update',
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
                    '检查更新',
                    latestRelease ? `发现新版本 ${latestRelease.tag}` : '当前已是最新版本',
                    () => window.open(latestRelease?.url ?? `${REPO_URL}/releases/latest`, '_blank', 'noopener'),
                  )}
                  {listRow(
                    'license',
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>,
                    '开源协议',
                    'MIT License',
                    () => window.open(`${REPO_URL}/blob/main/LICENSE`, '_blank', 'noopener'),
                  )}
                </div>
              </div>
            )}
          </div>

          {(tab === 'api' || tab === 'defaults') && (
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-2 dark:border-white/[0.08] sm:px-6 sm:py-3">
              <button
                onClick={handleClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
              >
                取消
              </button>
              <button
                onClick={handleClose}
                className="rounded-xl bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
