import type { ApiProfile } from '../types'
import { buildApiUrl, isApiProxyAvailable, readClientDevProxyConfig } from './devProxy'

export function parseUpstreamModels(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new Error('模型列表格式无效')
  }

  return Array.from(new Set((payload as { data: unknown[] }).data
    .map((item) => item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    .map((id) => id.trim())))
}

export async function fetchUpstreamModels(profile: ApiProfile, signal?: AbortSignal): Promise<string[]> {
  const url = buildApiUrl(profile.baseUrl, 'models', readClientDevProxyConfig(), profile.apiProxy && isApiProxyAvailable())
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${profile.apiKey.trim()}` },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(`获取模型列表失败（HTTP ${response.status}）`)
  return parseUpstreamModels(await response.json())
}
