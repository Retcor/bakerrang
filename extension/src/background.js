// Service worker: the only place that talks to the API and runs vault crypto.
// It reuses the web app's real crypto module (via the @vault-crypto alias), so
// the zero-knowledge guarantees are identical — the server never sees plaintext
// and the master password is never stored.

import { unlockVault, decryptItem } from '@vault-crypto'
import { getVaultMeta, getItems } from './lib/api.js'
import {
  loadSession, saveSession, clearSession, DEFAULT_SETTINGS, isIdleExpired, bytesToB64, b64ToBytes
} from './lib/session.js'
import { normalizeHost, entriesForTab } from './lib/match.js'

// ---- auto-lock ----

const ALARM = 'auto-lock'
chrome.alarms.create(ALARM, { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return
  const state = await loadSession()
  if (state && isIdleExpired(state)) await clearSession()
})

// Returns the live session if unlocked and not idle-expired, else null (locking).
const getUnlocked = async () => {
  const state = await loadSession()
  if (!state) return null
  if (isIdleExpired(state)) {
    await clearSession()
    return null
  }
  return state
}

const touch = async (state) => {
  state.lastActive = Date.now()
  await saveSession(state)
}

const importVaultKey = (rawB64) =>
  crypto.subtle.importKey('raw', b64ToBytes(rawB64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])

// Decrypt every personal-vault record with the vault key. Records that only have
// a folder-wrapped key (shared-folder items) are skipped — personal vault only.
const decryptAll = async (vaultKey, records) => {
  const out = []
  for (const rec of records) {
    if (!rec.wrappedItemKey) continue
    try {
      const item = await decryptItem(vaultKey, rec)
      out.push({ id: rec.id, ...item })
    } catch {
      // stale/foreign key copy — skip
    }
  }
  return out
}

// ---- message handlers ----

const handlers = {
  async status () {
    const state = await getUnlocked()
    return { unlocked: !!state, itemCount: state ? state.items.length : 0 }
  },

  async unlock ({ masterPassword }) {
    const meta = await getVaultMeta()
    if (!meta) return { ok: false, error: 'No vault found for this account. Create one in the web app first.' }

    let vaultKey
    try {
      vaultKey = await unlockVault(masterPassword, meta) // throws on wrong password (GCM tag)
    } catch {
      return { ok: false, error: 'Incorrect master password.' }
    }

    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey))
    const items = await getItems()
    // Merge server settings over defaults so autoLockMs/inlineAutofill are always
    // concrete (autoLockMs may still be null = never lock).
    const settings = { ...DEFAULT_SETTINGS, ...(meta.settings || {}) }
    const state = { vaultKeyRaw: bytesToB64(rawKey), items: items || [], settings, lastActive: Date.now() }
    await saveSession(state)
    return { ok: true, itemCount: state.items.length }
  },

  async matchesForTab ({ url }) {
    const state = await getUnlocked()
    if (!state) return { unlocked: false, matches: [] }

    const tabHost = normalizeHost(url)
    if (!tabHost) {
      await touch(state)
      return { unlocked: true, matches: [] }
    }

    const vaultKey = await importVaultKey(state.vaultKeyRaw)
    const decrypted = await decryptAll(vaultKey, state.items)
    const matches = entriesForTab(tabHost, decrypted).map((e) => ({
      id: e.id,
      title: e.title || '',
      username: e.username || '',
      url: e.url || ''
    }))
    await touch(state)
    return { unlocked: true, matches }
  },

  async fill ({ tabId, id }) {
    const state = await getUnlocked()
    if (!state) return { ok: false, error: 'Vault is locked.' }

    const rec = state.items.find((r) => r.id === id)
    if (!rec) return { ok: false, error: 'Entry not found.' }

    const vaultKey = await importVaultKey(state.vaultKeyRaw)
    let item
    try {
      item = await decryptItem(vaultKey, rec)
    } catch {
      return { ok: false, error: 'Could not decrypt this entry.' }
    }
    await touch(state)

    // Broadcast to all frames (no frameId). Only the frame that fills responds;
    // if none do, sendMessage rejects because the ports close with no response.
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'fill',
        payload: { username: item.username || '', password: item.password || '' }
      })
      if (!res || !res.ok) return { ok: false, error: 'No login fields found on this page.' }
      return { ok: true }
    } catch {
      return { ok: false, error: 'No login fields found on this page. Reload it and try again.' }
    }
  },

  // Inline autofill: the content script asks (on field focus) which entries match
  // this frame's URL. Metadata only — no passwords leave the SW here. Deliberately
  // does not reset the idle timer, so a page can't keep the vault alive by
  // programmatically focusing fields.
  async inlineMatches ({ url }) {
    const state = await getUnlocked()
    if (!state || !state.settings || !state.settings.inlineAutofill) return { enabled: false, matches: [] }
    const host = normalizeHost(url)
    if (!host) return { enabled: true, matches: [] }
    const vaultKey = await importVaultKey(state.vaultKeyRaw)
    const decrypted = await decryptAll(vaultKey, state.items)
    const matches = entriesForTab(host, decrypted).map((e) => ({
      id: e.id,
      title: e.title || '',
      username: e.username || ''
    }))
    return { enabled: true, matches }
  },

  // Inline autofill: fill the chosen entry into the exact frame that asked (the
  // content-script sender). Decryption stays in the SW; the credential goes only
  // to that one frame via frameId — no broadcast, works inside iframes.
  async fillHere ({ id }, sender) {
    const state = await getUnlocked()
    if (!state) return { ok: false, error: 'Vault is locked.' }
    if (!state.settings || !state.settings.inlineAutofill) return { ok: false, error: 'Inline autofill is disabled.' }

    const rec = state.items.find((r) => r.id === id)
    if (!rec) return { ok: false, error: 'Entry not found.' }

    const vaultKey = await importVaultKey(state.vaultKeyRaw)
    let item
    try {
      item = await decryptItem(vaultKey, rec)
    } catch {
      return { ok: false, error: 'Could not decrypt this entry.' }
    }
    await touch(state)

    const tabId = sender && sender.tab && sender.tab.id
    if (tabId == null) return { ok: false, error: 'No tab context.' }
    const frameId = sender && sender.frameId
    const opts = typeof frameId === 'number' ? { frameId } : undefined
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'fill',
        payload: { username: item.username || '', password: item.password || '' }
      }, opts)
      return res && res.ok ? { ok: true } : { ok: false, error: 'No login fields found.' }
    } catch {
      return { ok: false, error: 'Could not reach the page.' }
    }
  },

  async lock () {
    await clearSession()
    return { ok: true }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg && msg.type]
  if (!handler) return false
  handler(msg.payload || {}, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err && err.message ? err.message : 'Unexpected error.' }))
  return true // keep the message channel open for the async response
})
