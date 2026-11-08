import type { ApiProfile } from '../types'

export const DEFAULT_SVG_MODEL = 'gpt-6.1-sol'

export function splitModelList(value: string): string[] {
  return Array.from(new Set(value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)))
}

export function resolveApiProfileModel(profile: ApiProfile): ApiProfile {
  const models = splitModelList(profile.model)
  return { ...profile, model: models.includes(profile.selectedModel ?? '') ? profile.selectedModel! : models[0] ?? profile.model }
}

function modelVersion(model: string): number | null {
  const match = model.toLowerCase().match(/gpt-image-(\d+)(?:\.(\d+))?/)
  return match ? Number(match[1]) + Number(match[2] ?? 0) / 10 : null
}

export function getImageGenerationModel(profile: ApiProfile): string {
  return profile.provider === 'openai' && profile.apiMode === 'responses'
    ? profile.imageGenerationModel?.trim() || ''
    : profile.model
}

export function supportsExtendedQuality(profile: ApiProfile): boolean {
  const version = modelVersion(getImageGenerationModel(profile))
  return version !== null && version >= 2.5 && !(profile.provider === 'fal' && version >= 2.6)
}

export function supportsGptImage26Params(profile: ApiProfile): boolean {
  const version = modelVersion(getImageGenerationModel(profile))
  return version !== null && version >= 2.6
}

export function supportsImageMarkup(profile: ApiProfile): boolean {
  const version = modelVersion(profile.model)
  return profile.provider === 'fal' ? version !== null && version >= 2.6
    : profile.apiMode === 'images' && !profile.codexCli && version !== null && version >= 2.5
}
