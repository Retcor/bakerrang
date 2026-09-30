// Typed wrappers over the voice routes (docs/apps/PhaseH-Account.md §9.2). The shared
// api client adds credentials and the CSRF header; FormData passes through untouched.
const BASE = '/text/to/speech'

export class VoiceApiError extends Error {
  constructor (status, field) {
    super('Voice request failed')
    this.name = 'VoiceApiError'
    this.status = status
    this.field = field
  }
}

const readFailure = async (response) => {
  let field
  try {
    const body = await response.json()
    if (typeof body?.field === 'string') field = body.field
  } catch {
    // The status alone decides the copy.
  }
  return new VoiceApiError(response.status, field)
}

const readJson = async (response) => {
  if (!response.ok) throw await readFailure(response)
  return response.json()
}

// An aborted or timed-out request rejects with a non-VoiceApiError, which callers treat
// as "the outcome is unknown".
const withTimeout = (ms) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, done: () => clearTimeout(timer) }
}

const CREATE_TIMEOUT_MS = 120000
const REQUEST_TIMEOUT_MS = 30000

export const createVoicesApi = (client) => {
  const send = async (path, options, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const guard = withTimeout(timeoutMs)
    try {
      return await client.request(path, { ...options, signal: guard.signal })
    } finally {
      guard.done()
    }
  }
  const json = (method, body) => ({ method, body })

  return {
    list: async () => readJson(await send(`${BASE}/v1/voices`)),
    create: async ({ name, description, consent, files }) => {
      const form = new FormData()
      form.append('name', name)
      form.append('description', description)
      if (consent) form.append('consent', 'true')
      files.forEach((file) => form.append('files', file, file.name))
      return readJson(await send(`${BASE}/v1/voice`, { method: 'POST', body: form }, CREATE_TIMEOUT_MS))
    },
    rename: async (id, { name, description }) => readJson(await send(`${BASE}/v1/voices/${encodeURIComponent(id)}`, json('PATCH', { name, description }))),
    makePrimary: async (id) => readJson(await send(`${BASE}/v1/voices/primary`, json('PUT', { voiceId: id }))),
    remove: async (id) => readJson(await send(`${BASE}/v1/voice/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  }
}
