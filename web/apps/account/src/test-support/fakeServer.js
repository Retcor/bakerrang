import { vi } from 'vitest'

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const VOICE_PATH = '/text/to/speech'

// An in-memory stand-in for the API behind @bakerrang/web-api-client: preferences and the voice
// routes of docs/apps/PhaseH-Account.md §9, with the same first-voice-primary and single-primary rules.
export const createFakeServer = ({ voices = [], theme } = {}) => {
  const server = { voices: voices.map((voice) => ({ ...voice })), theme, calls: [], rules: [], counter: 100 }

  const body = async (options) => {
    if (options.body instanceof FormData) {
      const fields = {}
      const files = []
      for (const [key, value] of options.body.entries()) {
        if (typeof value === 'string') fields[key] = value
        else files.push({ key, name: value.name, type: value.type, size: value.size })
      }
      return { ...fields, files }
    }
    return options.body
  }

  const record = (voice) => ({ id: voice.id, name: voice.name, description: voice.description, isPrimary: voice.isPrimary })

  // Rules are consumed in order: { match: 'POST /path', times, network, status, hold }.
  const applyRules = async (method, path) => {
    const key = `${method} ${path}`
    const rule = server.rules.find((candidate) => key.startsWith(candidate.match) && candidate.times !== 0)
    if (!rule) return null
    if (typeof rule.times === 'number') rule.times -= 1
    if (rule.hold) await rule.hold
    if (rule.network) throw new TypeError('Failed to fetch')
    if (rule.status) return json(rule.body ?? { error: 'Failed' }, rule.status)
    return null
  }

  const handle = async (path, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase()
    const payload = await body(options)
    server.calls.push({ method, path, body: payload })
    const ruled = await applyRules(method, path)
    if (ruled) return ruled

    if (path === '/account/preferences') {
      if (method === 'PUT') { server.theme = payload.theme; return json({ theme: payload.theme }) }
      return json(server.theme ? { theme: server.theme } : {})
    }
    if (method === 'GET' && path === `${VOICE_PATH}/v1/voices`) return json(server.voices.map(record))
    if (method === 'POST' && path === `${VOICE_PATH}/v1/voice`) {
      server.counter += 1
      const voice = { id: `voice-${server.counter}`, name: payload.name.trim(), description: (payload.description || '').trim(), isPrimary: server.voices.length === 0 }
      server.voices.push(voice)
      return json(record(voice))
    }
    if (method === 'PUT' && path === `${VOICE_PATH}/v1/voices/primary`) {
      if (!server.voices.some((voice) => voice.id === payload.voiceId)) return json({ error: 'Voice not found' }, 404)
      server.voices.forEach((voice) => { voice.isPrimary = voice.id === payload.voiceId })
      return json(server.voices.map(record))
    }
    const rename = path.match(/^\/text\/to\/speech\/v1\/voices\/([^/]+)$/)
    if (method === 'PATCH' && rename) {
      const voice = server.voices.find((candidate) => candidate.id === decodeURIComponent(rename[1]))
      if (!voice) return json({ error: 'Voice not found' }, 404)
      if (payload.name !== undefined) voice.name = payload.name.trim()
      if (payload.description !== undefined) voice.description = payload.description.trim()
      return json(record(voice))
    }
    const remove = path.match(/^\/text\/to\/speech\/v1\/voice\/([^/]+)$/)
    if (method === 'DELETE' && remove) {
      const id = decodeURIComponent(remove[1])
      if (!server.voices.some((voice) => voice.id === id)) return json({ error: 'Not authorized to access this voice record.' }, 403)
      server.voices = server.voices.filter((voice) => voice.id !== id)
      return json({ success: true })
    }
    return json({ error: 'Unhandled in fake server' }, 500)
  }

  server.client = {
    request: vi.fn(handle),
    getJson: vi.fn(async (path, options) => {
      const response = await handle(path, options)
      if (!response.ok) {
        const error = new Error('Request failed')
        error.status = response.status
        throw error
      }
      return response.json()
    }),
    resetCsrf: vi.fn()
  }
  server.failNext = (match, rule = {}) => { server.rules.push({ match, times: 1, ...rule }) }
  server.holdNext = (match) => {
    let release
    const hold = new Promise((resolve) => { release = resolve })
    server.rules.push({ match, times: 1, hold })
    return release
  }
  server.callsTo = (method, path) => server.calls.filter((call) => call.method === method && call.path.startsWith(path))
  return server
}

export const twoVoices = () => [
  { id: 'v1', name: 'My voice', description: 'Recorded at my desk', isPrimary: true },
  { id: 'v2', name: 'Storyteller', description: 'Slower, warmer read for bedtime stories', isPrimary: false }
]
