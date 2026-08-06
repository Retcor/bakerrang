// Unlock state lives only in chrome.storage.session: an in-memory area the
// browser wipes when the browser closes and never writes to disk. We persist
// the raw vault key bytes (so the service worker can rehydrate after being
// killed without re-running Argon2id) plus the still-encrypted item records.
// The master password is never stored; decrypted entries are never stored.

const KEY = 'vaultState'

// Fallback preferences, mirroring client/src/utils/vaultSettings.js. The real
// values come from the server (GET /vault → settings) at unlock; these apply
// only until then / when the server omits a field.
export const DEFAULT_SETTINGS = {
  autoLockMs: 8 * 60 * 60 * 1000, // 8 hours
  inlineAutofill: true
}

// True when the unlocked session has been idle past its auto-lock duration.
// `autoLockMs === null` means never lock.
export const isIdleExpired = (state) => {
  const ms = state && state.settings ? state.settings.autoLockMs : DEFAULT_SETTINGS.autoLockMs
  if (ms === null) return false
  return Date.now() - state.lastActive > ms
}

// state shape: { vaultKeyRaw: base64, items: encryptedRecord[], settings, lastActive: number }
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
