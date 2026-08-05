// Unlock state lives only in chrome.storage.session: an in-memory area the
// browser wipes when the browser closes and never writes to disk. We persist
// the raw vault key bytes (so the service worker can rehydrate after being
// killed without re-running Argon2id) plus the still-encrypted item records.
// The master password is never stored; decrypted entries are never stored.

const KEY = 'vaultState'

export const AUTO_LOCK_MS = 15 * 60 * 1000 // mirrors the web app's 15-min idle lock

// state shape: { vaultKeyRaw: base64, items: encryptedRecord[], lastActive: number }
export const saveSession = (state) => chrome.storage.session.set({ [KEY]: state })

export const loadSession = async () => {
  const out = await chrome.storage.session.get(KEY)
  return out[KEY] || null
}

export const clearSession = () => chrome.storage.session.remove(KEY)

// ---- base64 <-> bytes (for the raw AES key) ----

export const bytesToB64 = (bytes) => {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export const b64ToBytes = (b64) => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
