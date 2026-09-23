const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const joinApiUrl = (baseUrl, path) => {
  if (/^https?:\/\//i.test(path)) return path
  return `${String(baseUrl || '').replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`
}

export const jsonOrThrow = async (response) => {
  if (response.ok) return response.json()
  const body = await response.json().catch(() => ({}))
  const error = new Error(body.error || body.message || `Request failed with status ${response.status}`)
  error.status = response.status
  throw error
}

export const createApiClient = ({ baseUrl = '', fetchImpl = globalThis.fetch } = {}) => {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')
  let csrfToken = null

  const fetchCsrfToken = async () => {
    const response = await fetchImpl(joinApiUrl(baseUrl, '/auth/csrf'), {
      credentials: 'include'
    })
    if (!response.ok) throw new Error('Failed to obtain CSRF token')
    const data = await response.json()
    if (!data.csrfToken) throw new Error('CSRF response did not include a token')
    csrfToken = data.csrfToken
    return csrfToken
  }

  const request = async (path, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase()
    const isMutating = MUTATING_METHODS.has(method)
    const requestOptions = {
      ...options,
      method,
      credentials: 'include',
      headers: { ...(options.headers || {}) }
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
      requestOptions.body = JSON.stringify(options.body)
      requestOptions.headers['content-type'] ||= 'application/json'
    }

    if (isMutating) {
      if (!csrfToken) await fetchCsrfToken()
      requestOptions.headers['x-csrf-token'] = csrfToken
    }

    let response = await fetchImpl(joinApiUrl(baseUrl, path), requestOptions)
    if (isMutating && response.status === 403) {
      const originalResponse = response
      try {
        await fetchCsrfToken()
        requestOptions.headers['x-csrf-token'] = csrfToken
        response = await fetchImpl(joinApiUrl(baseUrl, path), requestOptions)
      } catch {
        response = originalResponse
      }
    }
    return response
  }

  return {
    request,
    getJson: async (path, options) => jsonOrThrow(await request(path, options)),
    resetCsrf: () => { csrfToken = null }
  }
}
