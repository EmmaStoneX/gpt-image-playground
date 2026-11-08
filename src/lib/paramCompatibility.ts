import { DEFAULT_PARAMS, type AppSettings, type TaskParams } from '../types'
import { getActiveApiProfile } from './apiProfiles'
import { normalizeImageSize } from './size'
import { supportsExtendedQuality, supportsGptImage26Params } from './imageModels'

export const DEFAULT_FAL_IMAGE_SIZE = '1360x1024'
export const MAX_FAL_OUTPUT_IMAGES = 4
export const MAX_OPENAI_OUTPUT_IMAGES = 10

export function normalizeStoredTaskParams(value: Partial<TaskParams> | undefined): TaskParams {
  return { ...DEFAULT_PARAMS, ...value }
}

export function getParamDisabledReasons(settings: AppSettings) {
  const profile = getActiveApiProfile(settings)
  const isResponses = profile.provider === 'openai' && profile.apiMode === 'responses'
  const unsupported = isResponses ? '当前图像模型不支持此参数' : '当前模型不支持此参数'
  const supports26 = supportsGptImage26Params(profile)
  return {
    complexity: supports26 ? undefined : unsupported,
    gif: supports26 ? undefined : unsupported,
    svg: supports26 && profile.provider !== 'fal' ? undefined : profile.provider === 'fal' ? 'fal.ai 暂不支持 SVG' : unsupported,
    extendedQuality: supportsExtendedQuality(profile) ? undefined : '当前模型不支持此质量',
  }
}

export function getOutputImageLimitForSettings(settings: AppSettings) {
  return getActiveApiProfile(settings).provider === 'fal' ? MAX_FAL_OUTPUT_IMAGES : MAX_OPENAI_OUTPUT_IMAGES
}

export function normalizeParamsForSettings(params: TaskParams, settings: AppSettings): TaskParams {
  const activeProfile = getActiveApiProfile(settings)
  const outputImageLimit = getOutputImageLimitForSettings(settings)
  const nextParams: TaskParams = {
    ...DEFAULT_PARAMS,
    ...params,
    size: normalizeImageSize(params.size) || DEFAULT_PARAMS.size,
    n: Math.min(outputImageLimit, Math.max(1, params.n || DEFAULT_PARAMS.n)),
  }

  if (activeProfile.provider === 'openai' && activeProfile.codexCli) {
    nextParams.quality = DEFAULT_PARAMS.quality
  }

  if (activeProfile.provider === 'fal') {
    if (nextParams.size === 'auto') nextParams.size = DEFAULT_FAL_IMAGE_SIZE
    if (nextParams.quality === 'auto') nextParams.quality = 'high'
    nextParams.moderation = DEFAULT_PARAMS.moderation
    nextParams.output_compression = DEFAULT_PARAMS.output_compression
  }

  const disabled = getParamDisabledReasons(settings)
  if (disabled.extendedQuality && (nextParams.quality === 'xhigh' || nextParams.quality === 'max')) nextParams.quality = 'high'
  if (disabled.complexity) nextParams.complexity = 'auto'
  if (nextParams.output_format === 'svg' && disabled.svg) nextParams.output_format = 'png'
  if (nextParams.output_format === 'gif' && disabled.gif) nextParams.output_format = 'png'
  nextParams.frame_count = Math.min(16, Math.max(2, Math.round(Number(nextParams.frame_count) || DEFAULT_PARAMS.frame_count)))
  nextParams.frame_duration_ms = Math.min(2000, Math.max(20, Math.round(Number(nextParams.frame_duration_ms) || DEFAULT_PARAMS.frame_duration_ms)))

  if (nextParams.output_format === 'png' || nextParams.output_format === 'gif' || nextParams.output_format === 'svg') {
    nextParams.output_compression = DEFAULT_PARAMS.output_compression
  }

  return nextParams
}

export function getChangedParams(current: TaskParams, next: TaskParams): Partial<TaskParams> {
  const patch: Partial<TaskParams> = {}
  for (const key of Object.keys(next) as Array<keyof TaskParams>) {
    if (current[key] !== next[key]) {
      ;(patch as Record<keyof TaskParams, TaskParams[keyof TaskParams]>)[key] = next[key]
    }
  }
  return patch
}
