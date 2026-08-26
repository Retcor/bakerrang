export type Environment = Record<string, string | undefined>

export function requireHttpOrigin(env: Environment, name: string): string
export function validatePortalBuildConfig(env?: Environment): {
  apiBaseUrl: string
  previewOrigin: string
}
export function validateRendererBuildConfig(env?: Environment): {
  publicApiBaseUrl: string
}
export function validateRendererRuntimeConfig(env?: Environment): {
  apiBaseUrl: string
  indexingEnabled: boolean
  publicOrigin: string
}
