import { getActiveApiProfile } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import { composeMarkupDataUrl } from './canvasImage'
import { supportsImageMarkup } from './imageModels'
import type { CallApiOptions, CallApiResult } from './imageApiShared'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)
  const inputImageDataUrls = [...opts.inputImageDataUrls]
  let markupDataUrl = opts.markupDataUrl
  if (markupDataUrl && inputImageDataUrls.length && (opts.maskDataUrl || !supportsImageMarkup(profile))) {
    inputImageDataUrls[0] = await composeMarkupDataUrl(inputImageDataUrls[0], markupDataUrl)
    markupDataUrl = undefined
  }
  const request = { ...opts, inputImageDataUrls, markupDataUrl }
  if (profile.provider === 'fal') return callFalAiImageApi(request, profile)

  return callOpenAICompatibleImageApi(request, profile)
}
