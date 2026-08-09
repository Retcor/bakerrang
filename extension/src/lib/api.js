// Thin fetch wrappers for the vault's read endpoints. All are GET (no CSRF).
// credentials:'include' + the manifest host permission make the browser attach
// the httpOnly `connect.sid` session cookie, so the extension is authenticated
// as whoever is logged into the web app in this browser.

export const API_BASE = 'https://api.bakerrang.com'

class ApiError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
  }
}

const getJson = async (path) => {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  } catch (err) {
    throw new ApiError('Could not reach the server. Check your connection.', 'NETWORK')
  }
  if (res.status === 401) {
    throw new ApiError('Not signed in. Open the Bakerrang web app and log in first.', 'UNAUTHENTICATED')
  }
  if (res.status === 404) return null // vault not initialized
  if (!res.ok) throw new ApiError(`Request failed (${res.status}).`, 'HTTP')
  return res.json()
}

// GET /vault -> { kdf, protectedVaultKey, publicKey, protectedPrivateKey, ... } or null
export const getVaultMeta = () => getJson('/vault')

// GET /vault/items -> array of encrypted item records
export const getItems = () => getJson('/vault/items')

export { ApiError }
