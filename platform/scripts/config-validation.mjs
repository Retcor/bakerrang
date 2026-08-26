import { isIP } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const configuredValue = (env, name) => {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function requireHttpOrigin (env, name) {
  const value = configuredValue(env, name)
  if (!value) throw new Error(`${name} is required.`)

  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) throw new Error()
    return url.origin
  } catch {
    throw new Error(`${name} must be a valid absolute HTTP/HTTPS origin.`)
  }
}

export function validatePortalBuildConfig (env = process.env) {
  const apiBaseUrl = requireHttpOrigin(env, 'NEXT_PUBLIC_API_BASE_URL')
  const previewOrigin = requireHttpOrigin(env, 'NEXT_PUBLIC_SITE_PREVIEW_ORIGIN')
  const ipv4 = configuredValue(env, 'CUSTOM_DOMAIN_IPV4_ADDRESS')
  if (ipv4 && isIP(ipv4) !== 4) {
    throw new Error('CUSTOM_DOMAIN_IPV4_ADDRESS must be a valid IPv4 address when configured.')
  }
  return { apiBaseUrl, previewOrigin }
}

export function validateRendererBuildConfig (env = process.env) {
  return {
    publicApiBaseUrl: requireHttpOrigin(env, 'NEXT_PUBLIC_SITE_API_BASE_URL')
  }
}

export function validateRendererRuntimeConfig (env = process.env) {
  const apiBaseUrl = requireHttpOrigin(env, 'SITE_API_BASE_URL')
  const publicOrigin = requireHttpOrigin(env, 'SITE_PUBLIC_ORIGIN')
  const indexingEnabled = env.SITE_PUBLIC_INDEXING_ENABLED === 'true'
  return { apiBaseUrl, indexingEnabled, publicOrigin }
}

const command = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  ? process.argv[2]
  : null

if (command) {
  try {
    if (command === 'renderer-runtime') validateRendererRuntimeConfig()
    else throw new Error(`Unknown configuration validation command: ${command}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Configuration validation failed.')
    process.exitCode = 1
  }
}
