import { useEffect, useState } from 'react'
import type { ApiProfile } from '../types'
import { fetchUpstreamModels } from '../lib/upstreamModels'

export function useUpstreamModels(profile: ApiProfile, enabled = true) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    setModels([])
    setError('')
    if (!enabled || profile.provider !== 'openai' || !profile.apiKey.trim() || !profile.baseUrl.trim()) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchUpstreamModels(profile, controller.signal)
        .then(setModels)
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return
          setError(cause instanceof Error ? cause.message : '获取模型列表失败')
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [enabled, profile.id, profile.provider, profile.baseUrl, profile.apiKey, profile.apiProxy, reloadCount])

  return { models, loading, error, reload: () => setReloadCount((count) => count + 1) }
}
