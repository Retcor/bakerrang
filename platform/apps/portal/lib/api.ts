type UnsafeMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor (status: number, body: unknown) {
    const safeMessage = typeof body === 'object' && body !== null &&
      'error' in body && typeof body.error === 'string'
      ? body.error
      : `API request failed with status ${status}`
    super(safeMessage)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export function apiBaseUrl (): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!value) throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured')
  return value.replace(/\/$/, '')
}

async function parseResponseBody (response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

async function responseData<T> (response: Response): Promise<T> {
  const body = await parseResponseBody(response)
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}

export async function apiGet<T> (path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: 'include'
  })
  return responseData<T>(response)
}

let csrfToken: string | null = null

async function getCsrfToken (forceRefresh = false): Promise<string> {
  if (csrfToken && !forceRefresh) return csrfToken

  const response = await fetch(`${apiBaseUrl()}/auth/csrf`, {
    credentials: 'include'
  })
  const body = await responseData<{ csrfToken?: string }>(response)
  if (!body.csrfToken) throw new Error('CSRF token response was invalid')
  csrfToken = body.csrfToken
  return csrfToken
}

async function send<T> (
  method: UnsafeMethod,
  path: string,
  body: unknown,
  token: string
): Promise<T> {
  const headers: Record<string, string> = {
    'x-csrf-token': token
  }
  if (body !== undefined) headers['content-type'] = 'application/json'

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return responseData<T>(response)
}

export async function apiSend<T> (
  method: UnsafeMethod,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getCsrfToken()
  try {
    return await send<T>(method, path, body, token)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error
  }

  // A 403 can mean either stale CSRF state or genuine authorization denial.
  // Refresh once, retry once, and always surface a second 403 to the caller.
  csrfToken = null
  const refreshedToken = await getCsrfToken(true)
  return send<T>(method, path, body, refreshedToken)
}
