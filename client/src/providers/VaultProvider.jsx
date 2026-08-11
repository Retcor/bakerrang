import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { DEFAULT_SETTINGS, withSettingDefaults } from '../utils/vaultSettings.js'
import {
  createVault as cryptoCreateVault,
  unlockVault,
  rewrapVaultKey,
  encryptItem,
  decryptItem,
  encryptFolder,
  decryptFolder,
  createKeyPair,
  unwrapPrivateKey,
  importPublicKey,
  wrapKeyForRecipient,
  unwrapKeyFromSender,
  generateFolderKeyRaw,
  importFolderKey,
  wrapFolderKeyForVault,
  unwrapFolderKeyFromVault,
  rewrapItemKeyForFolder,
  encryptItemForFolder,
  decryptItemWithFolderKey,
  reencryptItemKeepingKey,
  encryptFolderName,
  decryptFolderName
} from '../utils/crypto.js'

const VaultContext = createContext()

// The topmost ancestor-or-self folder record (in a byId map of raw folder records)
// that carries a wrappedFolderKey — i.e. the OUTERMOST shared root above a folder.
// Sharing is one-key-per-subtree, so this is the canonical key for anything inside
// it. Using the outermost (not the nearest) key means a subfolder that was once
// shared separately and kept a stale, different key can't shadow the real subtree
// key and lock the top-level share's recipients out of edited entries.
const outermostSharedRecord = (byId, folderId) => {
  let cur = byId.get(folderId)
  const guard = new Set()
  let outer = null
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    if (cur.wrappedFolderKey) outer = cur
    cur = cur.parentId ? byId.get(cur.parentId) : null
  }
  return outer
}

// status: 'loading' | 'uninitialized' | 'locked' | 'unlocked'
export const VaultProvider = ({ children }) => {
  // Computed inside the component (not at module scope) to avoid a temporal
  // dead zone from the App.jsx <-> providers circular import.
  const VAULT_URL = `${SERVER_PREFIX}/vault`

  const [status, setStatus] = useState('loading')
  const [items, setItems] = useState([])
  const [folders, setFolders] = useState([])
  const [error, setError] = useState(null)
  // Server-synced, non-secret vault preferences (auto-lock duration, inline
  // autofill). Falls back to defaults until meta loads.
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  // Sharing (Phase 2)
  const [sharedFolders, setSharedFolders] = useState([]) // folders shared WITH me
  const [sharedItems, setSharedItems] = useState([]) // entries in the open shared subtree
  const [sharedTreeFolders, setSharedTreeFolders] = useState([]) // its descendant folders
  // Full decrypted subtree per share { [shareId]: { items, folders } }, prefetched
  // at unlock so the sidebar can show counts/subfolders/carets without a click.
  const [sharedTrees, setSharedTrees] = useState({})
  const [myShares, setMyShares] = useState([]) // shares I have granted
  // Real-time sync: another participant changed a shared folder (detected by
  // polling GET /vault/revisions). The UI decides whether to auto-apply or show a
  // "Refresh" banner. `revsRef` is the last-seen counter map; `changedRef` holds
  // the shareIds pending a re-fetch.
  const [updatesAvailable, setUpdatesAvailable] = useState(false)
  const revsRef = useRef({ received: {}, owned: {} })
  const changedRef = useRef({ received: new Set(), owned: new Set() })

  // The live vault key is kept in a ref, never in React state, so it is never
  // serialized into the component tree or persisted anywhere.
  const vaultKeyRef = useRef(null)
  const privateKeyRef = useRef(null) // sharing private key, in memory only
  const metaRef = useRef(null)
  const lockTimerRef = useRef(null)
  const rawItemsRef = useRef([]) // raw item records (needed to re-wrap keys when sharing)
  const rawFoldersRef = useRef([]) // raw folder records (to find shared-subtree keys)
  const folderKeysRef = useRef(new Map()) // folderId -> CryptoKey (owner side)
  const sharedKeysRef = useRef(new Map()) // folderId -> CryptoKey (shared with me)
  const sharedTreesRef = useRef({}) // mirrors sharedTrees so openSharedFolder reads the latest

  const jsonOrThrow = async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Request failed (${res.status})`)
    }
    return res.json()
  }

  const lock = useCallback(() => {
    vaultKeyRef.current = null
    privateKeyRef.current = null
    rawItemsRef.current = []
    folderKeysRef.current = new Map()
    sharedKeysRef.current = new Map()
    setItems([])
    setFolders([])
    setSharedFolders([])
    setSharedItems([])
    setSharedTreeFolders([])
    setMyShares([])
    setError(null)
    // Reset the real-time sync baseline so a re-unlock starts fresh.
    revsRef.current = { received: {}, owned: {} }
    changedRef.current = { received: new Set(), owned: new Set() }
    setUpdatesAvailable(false)
    setStatus((prev) => (prev === 'uninitialized' || prev === 'loading' ? prev : 'locked'))
  }, [])

  // Ensures the sharing keypair exists: unwraps the private key when present, or
  // generates one and persists it (migration for pre-Phase-2 vaults).
  const ensureKeypair = useCallback(async (vaultKey) => {
    const meta = metaRef.current || {}
    if (meta.publicKey && meta.protectedPrivateKey) {
      privateKeyRef.current = await unwrapPrivateKey(vaultKey, meta.protectedPrivateKey)
      return
    }
    const { publicKey, protectedPrivateKey } = await createKeyPair(vaultKey)
    await request(`${VAULT_URL}/keys`, 'POST', { 'Content-Type': 'application/json' },
      JSON.stringify({ publicKey, protectedPrivateKey })).then(jsonOrThrow)
    metaRef.current = { ...meta, publicKey, protectedPrivateKey }
    privateKeyRef.current = await unwrapPrivateKey(vaultKey, protectedPrivateKey)
  }, [VAULT_URL])

  // Load vault metadata once to decide initial status.
  const refreshMeta = useCallback(async () => {
    const res = await request(VAULT_URL, 'GET')
    if (res.status === 404) {
      metaRef.current = null
      setStatus('uninitialized')
      return
    }
    if (res.status === 401) {
      setStatus('loading')
      return
    }
    metaRef.current = await jsonOrThrow(res)
    setSettings(withSettingDefaults(metaRef.current.settings))
    setStatus('locked')
  }, [])

  // Persist a partial settings change to the server and reflect it locally so the
  // auto-lock timer (and any consumer) updates immediately.
  const updateSettings = useCallback(async (partial) => {
    const res = await request(
      `${VAULT_URL}/settings`, 'PUT',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ settings: partial })
    )
    const saved = await jsonOrThrow(res)
    const merged = withSettingDefaults(saved)
    if (metaRef.current) metaRef.current.settings = saved
    setSettings(merged)
    return merged
  }, [VAULT_URL])

  useEffect(() => {
    refreshMeta().catch((err) => setError(err.message))
  }, [refreshMeta])

  // Owner-side folder key for a shared folder (unwrapped from the vault key).
  const ownerFolderKey = useCallback(async (vaultKey, folderRecord) => {
    if (!folderRecord || !folderRecord.wrappedFolderKey) return null
    const cached = folderKeysRef.current.get(folderRecord.id)
    if (cached) return cached
    const raw = await unwrapFolderKeyFromVault(vaultKey, folderRecord.wrappedFolderKey)
    const key = await importFolderKey(raw)
    folderKeysRef.current.set(folderRecord.id, key)
    return key
  }, [])

  // Decrypt everything for the open vault into local state.
  const loadEntries = useCallback(async (vaultKey) => {
    const [rawItems, rawFolders] = await Promise.all([
      request(`${VAULT_URL}/items`, 'GET').then(jsonOrThrow),
      request(`${VAULT_URL}/folders`, 'GET').then(jsonOrThrow)
    ])
    rawItemsRef.current = rawItems
    rawFoldersRef.current = rawFolders

    const rawById = new Map(rawFolders.map((r) => [r.id, r]))
    // The folder key covering a folder = the key on its OUTERMOST shared ancestor
    // (one key covers a whole shared subtree; see outermostSharedRecord).
    const subtreeKey = async (folderId) => {
      const outer = outermostSharedRecord(rawById, folderId)
      return outer ? ownerFolderKey(vaultKey, outer) : null
    }

    // Folders a recipient created inside my shared subtree have no vault-key
    // name — read those with the folder key instead.
    const decFolders = await Promise.all(rawFolders.map(async (r) => {
      const base = {
        id: r.id,
        parentId: r.parentId || null,
        position: typeof r.position === 'number' ? r.position : null,
        shared: r.shared === true,
        wrappedFolderKey: r.wrappedFolderKey || null
      }
      try {
        if (r.ciphertext) return { ...base, ...(await decryptFolder(vaultKey, r)) }
        const fk = await subtreeKey(r.id)
        if (fk && r.sharedName) return { ...base, ...(await decryptFolderName(fk, r.sharedName)) }
      } catch (err) { /* fall through */ }
      return { ...base, name: '(unreadable folder)' }
    }))

    // Likewise for entries a recipient added — and note the vault-key copy can be
    // STALE if a recipient re-encrypted the entry with a new content key, so
    // always fall back to the folder key rather than giving up.
    const decItems = await Promise.all(rawItems.map(async (r) => {
      const base = { id: r.id, folderId: r.folderId || null, updatedAt: r.updatedAt }
      if (r.wrappedItemKey) {
        try {
          return { ...base, ...(await decryptItem(vaultKey, r)) }
        } catch (err) { /* stale vault-key copy — try the folder key below */ }
      }
      if (r.folderWrappedItemKey) {
        try {
          const fk = await subtreeKey(r.folderId)
          if (fk) return { ...base, ...(await decryptItemWithFolderKey(fk, r)) }
        } catch (err) { /* fall through to unreadable */ }
      }
      return { ...base, title: '(unreadable entry)', username: '', password: '', url: '', notes: '' }
    }))

    setItems(decItems)
    setFolders(decFolders)
  }, [ownerFolderKey])

  // The folder key covering a folder — i.e. the key on its nearest shared
  // ancestor. One key covers an entire shared subtree. Null if not shared.
  const subtreeKeyForFolder = useCallback(async (folderId) => {
    const vaultKey = vaultKeyRef.current
    if (!vaultKey || !folderId) return null
    const byId = new Map(rawFoldersRef.current.map((r) => [r.id, r]))
    const outer = outermostSharedRecord(byId, folderId)
    return outer ? ownerFolderKey(vaultKey, outer) : null
  }, [ownerFolderKey])

  // Everything a shared subtree needs so recipients can read it: a folder-key
  // name for every descendant folder, and a folder-key copy of every entry's
  // content key. `folders` state may not be loaded yet, so work from raw records.
  const buildSubtreeSetup = useCallback(async (vaultKey, folderKey, rootId, onlyMissing = false) => {
    const rawFolders = rawFoldersRef.current
    const childrenByParent = new Map()
    rawFolders.forEach((r) => {
      const p = r.parentId || null
      if (!childrenByParent.has(p)) childrenByParent.set(p, [])
      childrenByParent.get(p).push(r)
    })
    const subtree = new Set()
    const stack = [rootId]
    while (stack.length) {
      const cur = stack.pop()
      if (subtree.has(cur)) continue
      subtree.add(cur)
      for (const c of (childrenByParent.get(cur) || [])) stack.push(c.id)
    }

    const folderNames = []
    for (const r of rawFolders) {
      if (!subtree.has(r.id)) continue
      if (onlyMissing && r.sharedName) continue
      // The plaintext name comes from whichever copy we can already read.
      let name = null
      try {
        if (r.ciphertext) name = (await decryptFolder(vaultKey, r)).name
        else if (r.sharedName) name = (await decryptFolderName(folderKey, r.sharedName)).name
      } catch (err) { /* skip unreadable */ }
      if (name != null) folderNames.push({ id: r.id, sharedName: await encryptFolderName(folderKey, name) })
    }

    const itemKeys = []
    for (const r of rawItemsRef.current) {
      if (!subtree.has(r.folderId) || !r.wrappedItemKey) continue
      if (onlyMissing && r.folderWrappedItemKey) continue
      try {
        itemKeys.push({ id: r.id, folderWrappedItemKey: await rewrapItemKeyForFolder(vaultKey, folderKey, r) })
      } catch (err) { /* skip unreadable */ }
    }
    return { folderNames, itemKeys }
  }, [])

  // Backfills anything in my shared subtrees that recipients can't read yet —
  // heals shares made before recursive sharing, and picks up folders/entries I
  // added to a shared folder since. Best-effort; never blocks unlocking.
  const repairSharedSubtrees = useCallback(async (vaultKey) => {
    // Only heal from the OUTERMOST shared roots. A subfolder that carries a stale
    // wrappedFolderKey (from a since-revoked separate share) must NOT be treated as
    // its own root, or repair would re-wrap its entries with that stale key and
    // lock the top-level share's recipients out.
    const byId = new Map(rawFoldersRef.current.map((r) => [r.id, r]))
    const roots = rawFoldersRef.current.filter(
      (r) => r.wrappedFolderKey && outermostSharedRecord(byId, r.id).id === r.id
    )
    for (const root of roots) {
      try {
        const folderKey = await ownerFolderKey(vaultKey, root)
        if (!folderKey) continue
        const setup = await buildSubtreeSetup(vaultKey, folderKey, root.id, true)
        if (!setup.folderNames.length && !setup.itemKeys.length) continue
        await request(`${VAULT_URL}/folders/${root.id}/share-setup`, 'PUT',
          { 'Content-Type': 'application/json' }, JSON.stringify(setup)).then(jsonOrThrow)
      } catch (err) { /* best effort */ }
    }
  }, [ownerFolderKey, buildSubtreeSetup])

  // Shares I have granted (used to badge shared folders and list recipients).
  // Defined before unlock() so it can be referenced in its dependency list.
  const loadMyShares = useCallback(async () => {
    const shares = await request(`${VAULT_URL}/shares`, 'GET').then(jsonOrThrow)
    setMyShares(shares)
    return shares
  }, [])

  // Folders shared WITH me: unwrap each folder key with my private key so I can
  // read the folder name (and later its entries).
  const loadSharedWithMe = useCallback(async () => {
    const priv = privateKeyRef.current
    if (!priv) return []
    const shares = await request(`${VAULT_URL}/shared`, 'GET').then(jsonOrThrow)
    const out = []
    for (const s of shares) {
      try {
        const raw = await unwrapKeyFromSender(s.wrappedFolderKey, priv)
        const folderKey = await importFolderKey(raw)
        sharedKeysRef.current.set(s.folderId, folderKey)
        const meta = s.sharedName ? await decryptFolderName(folderKey, s.sharedName) : { name: 'Shared folder' }
        out.push({ ...s, name: meta.name })
      } catch (err) { /* can't decrypt (e.g. stale share) — skip it */ }
    }
    setSharedFolders(out)
    return out
  }, [])

  // Fetch + decrypt a shared folder's WHOLE subtree: every descendant folder and
  // every entry inside it, at any depth. One folder key opens all of it. Pure —
  // returns the decrypted tree without touching state, so it can back both the
  // up-front prefetch and the on-click open.
  const fetchSharedTree = useCallback(async (shared) => {
    const folderKey = sharedKeysRef.current.get(shared.folderId)
    if (!folderKey) throw new Error('Missing folder key for this shared folder')
    const tree = await request(`${VAULT_URL}/shared/${shared.ownerId}/tree/${shared.folderId}`, 'GET').then(jsonOrThrow)

    const decItems = await Promise.all((tree.items || []).map(async (r) => {
      const base = { id: r.id, folderId: r.folderId, updatedAt: r.updatedAt }
      try {
        return { ...base, ...(await decryptItemWithFolderKey(folderKey, r)) }
      } catch (err) {
        return { ...base, title: '(unreadable entry)', username: '', password: '', url: '', notes: '' }
      }
    }))
    const decFolders = await Promise.all((tree.folders || []).map(async (r) => {
      let name = 'Folder'
      try {
        if (r.sharedName) name = (await decryptFolderName(folderKey, r.sharedName)).name
      } catch (err) { /* keep placeholder */ }
      return { id: r.id, parentId: r.parentId || null, position: r.position, name }
    }))
    return { items: decItems, folders: decFolders }
  }, [])

  // Prefetch every share's subtree so the sidebar can render counts/subfolders/
  // carets up front. Non-blocking at unlock; failures per-share are skipped.
  const loadSharedTrees = useCallback(async (shares) => {
    const list = shares || []
    const entries = await Promise.all(list.map(async (s) => {
      try {
        return [s.shareId, await fetchSharedTree(s)]
      } catch (err) { return null }
    }))
    const map = {}
    for (const e of entries) { if (e) map[e[0]] = e[1] }
    sharedTreesRef.current = map
    setSharedTrees(map)
    return map
  }, [fetchSharedTree])

  // Re-fetch the shared data that another participant changed (drains changedRef).
  // Received-side changes → refresh the shared-with-me folders + their subtrees;
  // owned-side changes (a recipient edited a folder I own) → reload my own tree.
  const applyUpdates = useCallback(async () => {
    const changed = changedRef.current
    const hasReceived = changed.received.size > 0
    const hasOwned = changed.owned.size > 0
    changedRef.current = { received: new Set(), owned: new Set() }
    setUpdatesAvailable(false)
    try {
      if (hasReceived) {
        const shares = await loadSharedWithMe()
        await loadSharedTrees(shares)
      }
      if (hasOwned && vaultKeyRef.current) await loadEntries(vaultKeyRef.current)
    } catch (err) { /* leave it; the next poll will re-flag */ }
  }, [loadSharedWithMe, loadSharedTrees, loadEntries])

  const createVault = useCallback(async (masterPassword) => {
    const { kdf, protectedVaultKey, vaultKey, publicKey, protectedPrivateKey } = await cryptoCreateVault(masterPassword)
    await request(VAULT_URL, 'POST', { 'Content-Type': 'application/json' },
      JSON.stringify({ kdf, protectedVaultKey, publicKey, protectedPrivateKey })).then(jsonOrThrow)
    metaRef.current = { kdf, protectedVaultKey, publicKey, protectedPrivateKey }
    vaultKeyRef.current = vaultKey
    privateKeyRef.current = await unwrapPrivateKey(vaultKey, protectedPrivateKey)
    setItems([])
    setFolders([])
    setStatus('unlocked')
  }, [VAULT_URL])

  const unlock = useCallback(async (masterPassword) => {
    if (!metaRef.current) await refreshMeta()
    // Throws on wrong password (GCM tag failure) — no server round-trip needed.
    const vaultKey = await unlockVault(masterPassword, metaRef.current)
    vaultKeyRef.current = vaultKey
    await ensureKeypair(vaultKey)
    await loadEntries(vaultKey)
    setStatus('unlocked')
    // Sharing data is non-critical to unlocking — don't block or fail the unlock.
    loadMyShares().catch(() => {})
    // Load the shared-folder names, then prefetch each subtree so the sidebar can
    // show counts/subfolders/carets without a click.
    loadSharedWithMe().then((shares) => loadSharedTrees(shares)).catch(() => {})
    repairSharedSubtrees(vaultKey).catch(() => {})
  }, [refreshMeta, loadEntries, ensureKeypair, loadMyShares, loadSharedWithMe, loadSharedTrees, repairSharedSubtrees])

  // Raw (still-encrypted) records mirror what the server holds. Sharing re-wraps
  // content keys from these, so every create/update/delete must keep them in
  // sync — otherwise entries added this session are invisible to recipients.
  const upsertRawItem = (record) => {
    rawItemsRef.current = [...rawItemsRef.current.filter((r) => r.id !== record.id), record]
  }
  const upsertRawFolder = (record) => {
    rawFoldersRef.current = [...rawFoldersRef.current.filter((r) => r.id !== record.id), record]
  }

  const requireKey = () => {
    if (!vaultKeyRef.current) throw new Error('Vault is locked')
    return vaultKeyRef.current
  }

  const saveItem = useCallback(async (item) => {
    const vaultKey = requireKey()
    const content = {
      title: item.title || '',
      username: item.username || '',
      password: item.password || '',
      url: item.url || '',
      notes: item.notes || ''
    }
    // If the entry lives anywhere inside a subtree I've shared, also wrap its
    // content key to that folder key so recipients keep access after an edit.
    const folderKey = await subtreeKeyForFolder(item.folderId)
    let encrypted
    if (folderKey) {
      encrypted = await encryptItemForFolder(vaultKey, folderKey, content)
    } else {
      // No resolvable folder key. If this is an EXISTING entry that already has a
      // folder-key copy (i.e. it's shared), keep its content key so that copy stays
      // valid — otherwise a new vault-only key would silently lock recipients out.
      const existingRaw = item.id ? rawItemsRef.current.find((r) => r.id === item.id) : null
      if (existingRaw && existingRaw.folderWrappedItemKey) {
        try {
          encrypted = await reencryptItemKeepingKey({ vaultKey, record: existingRaw }, content)
        } catch (err) {
          encrypted = await encryptItem(vaultKey, content)
        }
      } else {
        encrypted = await encryptItem(vaultKey, content)
      }
    }
    const body = JSON.stringify({ folderId: item.folderId || null, ...encrypted })
    const headers = { 'Content-Type': 'application/json' }
    const saved = item.id
      ? await request(`${VAULT_URL}/items/${item.id}`, 'PUT', headers, body).then(jsonOrThrow)
      : await request(`${VAULT_URL}/items`, 'POST', headers, body).then(jsonOrThrow)

    const merged = { id: saved.id, folderId: saved.folderId || null, updatedAt: saved.updatedAt, ...content }
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === merged.id)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = merged; return copy }
      return [...prev, merged]
    })
    // Keep the raw (encrypted) record too — sharing re-wraps keys from these, so
    // a stale list means newly added entries would be unreadable to recipients.
    upsertRawItem({ id: saved.id, folderId: saved.folderId || null, updatedAt: saved.updatedAt, ...encrypted })
    return merged
  }, [subtreeKeyForFolder])

  const deleteItem = useCallback(async (id) => {
    await request(`${VAULT_URL}/items/${id}`, 'DELETE').then(jsonOrThrow)
    setItems((prev) => prev.filter((i) => i.id !== id))
    rawItemsRef.current = rawItemsRef.current.filter((r) => r.id !== id)
  }, [])

  // Bulk delete: reuse the vetted per-item DELETE endpoint (no new server route,
  // no change to the authorization path), then prune state once. Only ids the
  // server actually deleted are removed, so a partial failure leaves the rest
  // intact and surfaces as a thrown error.
  const deleteItems = useCallback(async (ids) => {
    const results = await Promise.allSettled(
      ids.map((id) => request(`${VAULT_URL}/items/${id}`, 'DELETE').then(jsonOrThrow))
    )
    const deleted = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'))
    if (deleted.size) {
      setItems((prev) => prev.filter((i) => !deleted.has(i.id)))
      rawItemsRef.current = rawItemsRef.current.filter((r) => !deleted.has(r.id))
    }
    const failed = results.find((r) => r.status === 'rejected')
    if (failed) throw (failed.reason || new Error('Failed to delete some entries'))
  }, [])

  const moveItems = useCallback(async (ids, folderId) => {
    // Moving INTO a shared subtree: re-wrap each entry's content key to that
    // folder key so recipients can read them. Moving out: send an empty map so
    // the server drops the now-stale key.
    const vaultKey = requireKey()
    const folderKey = await subtreeKeyForFolder(folderId)
    const folderKeys = {}
    if (folderKey) {
      for (const id of ids) {
        const raw = rawItemsRef.current.find((r) => r.id === id)
        if (!raw) continue
        try {
          if (raw.wrappedItemKey) {
            folderKeys[id] = await rewrapItemKeyForFolder(vaultKey, folderKey, raw)
          } else if (raw.folderWrappedItemKey) {
            // Already keyed to the same subtree — keep the existing wrapping.
            folderKeys[id] = raw.folderWrappedItemKey
          }
        } catch (err) { /* leave it unwrapped rather than fail the whole move */ }
      }
    }
    await request(`${VAULT_URL}/items/move`, 'PUT', { 'Content-Type': 'application/json' },
      JSON.stringify({ ids, folderId: folderId || null, folderKeys })).then(jsonOrThrow)
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, folderId: folderId || null } : i)))
    // Keep raw records in sync so a follow-up move re-wraps correctly.
    rawItemsRef.current = rawItemsRef.current.map((r) => (
      ids.includes(r.id)
        ? { ...r, folderId: folderId || null, folderWrappedItemKey: folderKeys[r.id] || null }
        : r
    ))
  }, [subtreeKeyForFolder])

  const saveFolder = useCallback(async (folder) => {
    const vaultKey = requireKey()
    const name = folder.name || ''
    const encrypted = await encryptFolder(vaultKey, { name })
    // A folder created/renamed inside a shared subtree also needs a folder-key
    // name so recipients can read it.
    const parentKey = await subtreeKeyForFolder(folder.parentId || folder.id)
    const sharedName = parentKey ? await encryptFolderName(parentKey, name) : undefined
    const body = JSON.stringify({ parentId: folder.parentId || null, ...encrypted, ...(sharedName ? { sharedName } : {}) })
    const headers = { 'Content-Type': 'application/json' }
    const saved = folder.id
      ? await request(`${VAULT_URL}/folders/${folder.id}`, 'PUT', headers, body).then(jsonOrThrow)
      : await request(`${VAULT_URL}/folders`, 'POST', headers, body).then(jsonOrThrow)

    // Build the merged record BEFORE touching state. Callers (the KeePass
    // import) need the new id back synchronously, and a value captured inside a
    // setState updater isn't available yet when this function returns.
    const prevRaw = rawFoldersRef.current.find((r) => r.id === saved.id) || {}
    // Preserve ordering: the rename response doesn't echo position.
    const position = typeof saved.position === 'number'
      ? saved.position
      : (typeof prevRaw.position === 'number' ? prevRaw.position : null)
    const merged = { id: saved.id, parentId: saved.parentId || null, position, name }

    setFolders((prev) => {
      const idx = prev.findIndex((f) => f.id === merged.id)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = merged; return copy }
      return [...prev, merged]
    })
    // Mirror the raw record (keeps the shared-subtree walk correct).
    upsertRawFolder({
      ...prevRaw,
      id: merged.id,
      parentId: merged.parentId,
      position: merged.position,
      ...encrypted,
      ...(sharedName ? { sharedName } : {})
    })
    return merged
  }, [subtreeKeyForFolder])

  const reorderFolders = useCallback(async (updates) => {
    await request(`${VAULT_URL}/folders/reorder`, 'PUT',
      { 'Content-Type': 'application/json' }, JSON.stringify({ updates })).then(jsonOrThrow)
    setFolders((prev) => prev.map((f) => {
      const u = updates.find((x) => x.id === f.id)
      return u ? { ...f, parentId: u.parentId || null, position: u.position } : f
    }))
    rawFoldersRef.current = rawFoldersRef.current.map((r) => {
      const u = updates.find((x) => x.id === r.id)
      return u ? { ...r, parentId: u.parentId || null, position: u.position } : r
    })
  }, [])

  const deleteFolder = useCallback(async (id) => {
    await request(`${VAULT_URL}/folders/${id}`, 'DELETE').then(jsonOrThrow)
    setFolders((prev) => prev.filter((f) => f.id !== id))
    // Items in that folder were detached server-side; reflect that locally.
    setItems((prev) => prev.map((i) => (i.folderId === id ? { ...i, folderId: null } : i)))
    rawFoldersRef.current = rawFoldersRef.current.filter((r) => r.id !== id)
    rawItemsRef.current = rawItemsRef.current.map((r) => (r.folderId === id ? { ...r, folderId: null } : r))
  }, [])

  // Bulk import (KeePass). entries: [{ folderId, title, username, password, url, notes }]
  const importItems = useCallback(async (entries) => {
    const vaultKey = requireKey()
    // Importing into an already-shared folder must wrap to that folder key too.
    const keyCache = new Map()
    const folderKeyFor = async (folderId) => {
      if (!folderId) return null
      if (!keyCache.has(folderId)) keyCache.set(folderId, await subtreeKeyForFolder(folderId))
      return keyCache.get(folderId)
    }

    const payload = []
    for (const e of entries) {
      const content = {
        title: e.title || '',
        username: e.username || '',
        password: e.password || '',
        url: e.url || '',
        notes: e.notes || ''
      }
      const fk = await folderKeyFor(e.folderId)
      const encrypted = fk
        ? await encryptItemForFolder(vaultKey, fk, content)
        : await encryptItem(vaultKey, content)
      payload.push({ folderId: e.folderId || null, ...encrypted, _content: content })
    }
    const created = await request(`${VAULT_URL}/items/bulk`, 'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ items: payload.map(({ _content, ...rest }) => rest) })).then(jsonOrThrow)

    const newItems = created.map((saved, idx) => ({
      id: saved.id,
      folderId: saved.folderId || null,
      updatedAt: saved.updatedAt,
      ...payload[idx]._content
    }))
    setItems((prev) => [...prev, ...newItems])
    // Mirror the raw records so a share right after an import wraps these keys.
    created.forEach((saved, idx) => {
      const { _content, ...enc } = payload[idx]
      upsertRawItem({ id: saved.id, folderId: saved.folderId || null, updatedAt: saved.updatedAt, ...enc })
    })
    return newItems
  }, [subtreeKeyForFolder])

  const changeMasterPassword = useCallback(async (newPassword) => {
    const vaultKey = requireKey()
    const { kdf, protectedVaultKey } = await rewrapVaultKey(newPassword, vaultKey)
    await request(`${VAULT_URL}/key`, 'PUT', { 'Content-Type': 'application/json' },
      JSON.stringify({ kdf, protectedVaultKey })).then(jsonOrThrow)
    metaRef.current = { ...(metaRef.current || {}), kdf, protectedVaultKey }
  }, [])

  // ---- Sharing (Phase 2) ----

  // Keep a share's prefetched subtree (used for the sidebar counts) in lockstep
  // with the open-subtree edits below, so counts never go stale after a
  // recipient adds/moves/imports an entry.
  const patchSharedTreeItems = useCallback((shareId, updater) => {
    setSharedTrees((prev) => {
      const cur = prev[shareId]
      if (!cur) return prev
      const next = { ...prev, [shareId]: { ...cur, items: updater(cur.items) } }
      sharedTreesRef.current = next
      return next
    })
  }, [])

  // Select a shared folder for the main content pane. Reuses the prefetched tree
  // when available (no re-fetch) and falls back to a fresh fetch otherwise,
  // refreshing the cache so the sidebar reflects the latest.
  const openSharedFolder = useCallback(async (shared) => {
    const cached = sharedTreesRef.current[shared.shareId]
    const tree = cached || await fetchSharedTree(shared)
    if (!cached) {
      setSharedTrees((prev) => {
        const next = { ...prev, [shared.shareId]: tree }
        sharedTreesRef.current = next
        return next
      })
    }
    setSharedItems(tree.items)
    setSharedTreeFolders(tree.folders)
    return tree
  }, [fetchSharedTree])

  // Move entries between folders inside a shared subtree (needs 'edit'). The
  // folder key is the same throughout, so the wrapped key doesn't change.
  const moveSharedItems = useCallback(async (shared, ids, folderId) => {
    const updates = ids.map((id) => ({ id, folderId }))
    await request(`${VAULT_URL}/shared/${shared.ownerId}/items/move`, 'PUT',
      { 'Content-Type': 'application/json' }, JSON.stringify({ updates })).then(jsonOrThrow)
    const apply = (items) => items.map((i) => (ids.includes(i.id) ? { ...i, folderId } : i))
    setSharedItems(apply)
    patchSharedTreeItems(shared.shareId, apply)
  }, [patchSharedTreeItems])

  // Bulk-import entries into a shared subtree (KeePass import by a recipient).
  const importSharedItems = useCallback(async (shared, entries) => {
    const folderKey = sharedKeysRef.current.get(shared.folderId)
    if (!folderKey) throw new Error('Missing folder key for this shared folder')
    const payload = []
    const contents = []
    for (const e of entries) {
      const content = {
        title: e.title || '',
        username: e.username || '',
        password: e.password || '',
        url: e.url || '',
        notes: e.notes || ''
      }
      const enc = await encryptItemForFolder(null, folderKey, content)
      payload.push({ folderId: e.folderId || shared.folderId, ciphertext: enc.ciphertext, folderWrappedItemKey: enc.folderWrappedItemKey })
      contents.push(content)
    }
    const created = await request(`${VAULT_URL}/shared/${shared.ownerId}/items/bulk`, 'POST',
      { 'Content-Type': 'application/json' }, JSON.stringify({ items: payload })).then(jsonOrThrow)
    const newItems = created.map((saved, idx) => ({
      id: saved.id, folderId: saved.folderId, updatedAt: saved.updatedAt, ...contents[idx]
    }))
    setSharedItems((prev) => [...prev, ...newItems])
    patchSharedTreeItems(shared.shareId, (items) => [...items, ...newItems])
    return newItems
  }, [patchSharedTreeItems])

  // Create/update an entry inside a folder shared with me (needs 'edit').
  // `targetFolderId` lets it land in a subfolder of the shared subtree.
  const saveSharedItem = useCallback(async (shared, item, targetFolderId) => {
    const folderKey = sharedKeysRef.current.get(shared.folderId)
    if (!folderKey) throw new Error('Missing folder key for this shared folder')
    const content = {
      title: item.title || '',
      username: item.username || '',
      password: item.password || '',
      url: item.url || '',
      notes: item.notes || ''
    }
    // No vault key here — the entry is keyed to the folder key only.
    const encrypted = await encryptItemForFolder(null, folderKey, content)
    const body = JSON.stringify({ ciphertext: encrypted.ciphertext, folderWrappedItemKey: encrypted.folderWrappedItemKey })
    const headers = { 'Content-Type': 'application/json' }
    // The shared PUT response carries no folderId, so `merged` below falls back to
    // this. An existing entry must keep its OWN folder — vault search spans the
    // whole shared subtree, so an edited entry can come from any subfolder and
    // preferring the caller's target would silently re-file it in local state.
    // New entries have no folderId yet, so they still land on the caller's target.
    const targetFolder = (item.id && item.folderId) || targetFolderId || shared.folderId
    const saved = item.id
      ? await request(`${VAULT_URL}/shared/${shared.ownerId}/items/${item.id}`, 'PUT', headers, body).then(jsonOrThrow)
      : await request(`${VAULT_URL}/shared/${shared.ownerId}/folders/${targetFolder}/items`, 'POST', headers, body).then(jsonOrThrow)

    const merged = { id: saved.id, folderId: saved.folderId || targetFolder, updatedAt: saved.updatedAt, ...content }
    const upsert = (items) => {
      const idx = items.findIndex((i) => i.id === merged.id)
      if (idx >= 0) { const copy = [...items]; copy[idx] = merged; return copy }
      return [...items, merged]
    }
    setSharedItems(upsert)
    patchSharedTreeItems(shared.shareId, upsert)
    return merged
  }, [patchSharedTreeItems])

  // Share one of my folders with another user by email.
  const shareFolder = useCallback(async (folderId, recipientEmail, permission) => {
    const vaultKey = requireKey()
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) throw new Error('Folder not found')

    // Recipient must already have a vault (server returns a clear error if not).
    const { publicKey } = await request(
      `${VAULT_URL}/pubkey?email=${encodeURIComponent(recipientEmail)}`, 'GET').then(jsonOrThrow)
    const recipientKey = await importPublicKey(publicKey)

    // Sharing is recursive with ONE key per subtree. If this folder is already
    // inside a shared subtree, reuse that subtree's (outermost) key rather than
    // minting a new one — a second, different key on a nested folder is exactly
    // what locks the parent share's recipients out of entries here.
    const byId = new Map(rawFoldersRef.current.map((r) => [r.id, r]))
    const outerRec = outermostSharedRecord(byId, folderId)
    const folderKeyRaw = outerRec
      ? await unwrapFolderKeyFromVault(vaultKey, outerRec.wrappedFolderKey)
      : generateFolderKeyRaw()
    const folderKey = await importFolderKey(folderKeyRaw)
    folderKeysRef.current.set(folderId, folderKey)

    const wrappedFolderKey = (outerRec && outerRec.wrappedFolderKey) || await wrapFolderKeyForVault(vaultKey, folderKeyRaw)
    const { folderNames, itemKeys } = await buildSubtreeSetup(vaultKey, folderKey, folderId)
    const folderSetup = {
      wrappedFolderKey,
      sharedName: await encryptFolderName(folderKey, folder.name),
      folderNames,
      itemKeys
    }

    const wrappedForRecipient = await wrapKeyForRecipient(folderKeyRaw, recipientKey)
    const share = await request(`${VAULT_URL}/shares`, 'POST', { 'Content-Type': 'application/json' },
      JSON.stringify({ folderId, recipientEmail, permission, wrappedFolderKey: wrappedForRecipient, folderSetup }))
      .then(jsonOrThrow)

    if (folderSetup) {
      setFolders((prev) => prev.map((f) => (
        f.id === folderId ? { ...f, shared: true, wrappedFolderKey: folderSetup.wrappedFolderKey } : f
      )))
      // Raw records back subtreeKeyForFolder, so they must know about the key too.
      rawFoldersRef.current = rawFoldersRef.current.map((r) => (
        r.id === folderId ? { ...r, shared: true, wrappedFolderKey: folderSetup.wrappedFolderKey } : r
      ))
      rawItemsRef.current = rawItemsRef.current.map((r) => {
        const ik = folderSetup.itemKeys.find((k) => k.id === r.id)
        return ik ? { ...r, folderWrappedItemKey: ik.folderWrappedItemKey } : r
      })
    }
    await loadMyShares()
    return share
  }, [folders, loadMyShares])

  const revokeShare = useCallback(async (shareId) => {
    await request(`${VAULT_URL}/shares/${shareId}`, 'DELETE').then(jsonOrThrow)
    setMyShares((prev) => prev.filter((s) => s.id !== shareId))
  }, [])

  // Re-wrap a shared folder's ENTIRE subtree (every folder name + every entry's
  // content key) to the correct outermost-subtree key, then persist it. Heals
  // entries left unreadable to recipients by a past key conflict (e.g. a subfolder
  // that was once shared separately). Force mode (not onlyMissing) so it fixes
  // entries that already have a stale folder-key copy.
  const repairFolderSharing = useCallback(async (folderId) => {
    const vaultKey = requireKey()
    const byId = new Map(rawFoldersRef.current.map((r) => [r.id, r]))
    const outerRec = outermostSharedRecord(byId, folderId)
    if (!outerRec) throw new Error('This folder is not shared')
    const folderKey = await ownerFolderKey(vaultKey, outerRec)
    if (!folderKey) throw new Error('Could not load this folder’s key')
    const setup = await buildSubtreeSetup(vaultKey, folderKey, outerRec.id, false)
    await request(`${VAULT_URL}/folders/${outerRec.id}/share-setup`, 'PUT',
      { 'Content-Type': 'application/json' }, JSON.stringify(setup)).then(jsonOrThrow)
    // Keep raw records in sync so later edits/shares re-wrap from the correct key.
    const keyById = new Map(setup.itemKeys.map((k) => [k.id, k.folderWrappedItemKey]))
    rawItemsRef.current = rawItemsRef.current.map((r) => (
      keyById.has(r.id) ? { ...r, folderWrappedItemKey: keyById.get(r.id) } : r
    ))
    return { folders: setup.folderNames.length, items: setup.itemKeys.length }
  }, [ownerFolderKey, buildSubtreeSetup])

  // Inactivity auto-lock while unlocked. `autoLockMs === null` means never lock,
  // so we don't arm any timer or listeners in that case.
  useEffect(() => {
    if (status !== 'unlocked' || settings.autoLockMs === null) return
    const resetTimer = () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      lockTimerRef.current = setTimeout(lock, settings.autoLockMs)
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    // Capture phase: `scroll` doesn't bubble from an element, so without it
    // scrolling the entry list or folder tree (both inner scroll containers)
    // wouldn't count as activity and the vault could lock while you're actively
    // browsing it. Both add/remove must pass `true` or the listener leaks.
    events.forEach((e) => window.addEventListener(e, resetTimer, true))
    resetTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer, true))
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    }
  }, [status, lock, settings.autoLockMs])

  // Poll the shared-folder change counters while unlocked. Detects edits made by
  // other participants — and a share newly granted TO the user mid-session — and
  // flags them for the UI (auto-apply or a "Refresh" banner). Paused while the tab
  // is hidden; the first tick just seeds the baseline (no false positives). The
  // request is tiny (ids -> integers) and a no-op for users with no shares.
  useEffect(() => {
    if (status !== 'unlocked') return
    let cancelled = false
    let seeded = false

    // /revisions returns { [shareId]: { rev, mine } }; the baseline stores just the
    // rev numbers. `mine` = the latest change was made by me, so it never flags —
    // that's how you avoid getting notified of your own edits.
    const toRevMap = (m = {}) => Object.fromEntries(Object.entries(m).map(([id, v]) => [id, v.rev]))
    // `flagStructural` = flag shares that newly appeared or disappeared. True only
    // for the received side: a received share appearing/vanishing is the OWNER
    // sharing with me / revoking my access. On the owned side those are MY own
    // share/revoke actions, so they must not notify me. Content-rev changes are
    // always compared (a recipient editing my shared folder still notifies me).
    const diff = (nextMap = {}, baseMap = {}, set, flagStructural) => {
      for (const [id, { rev, mine }] of Object.entries(nextMap)) {
        if (mine) continue // my own change — never notify me
        const prev = baseMap[id]
        if (prev === undefined) { if (flagStructural) set.add(id) } else if (rev !== prev) set.add(id)
      }
      if (flagStructural) {
        for (const id of Object.keys(baseMap)) { if (nextMap[id] === undefined) set.add(id) }
      }
    }

    const poll = async () => {
      if (document.hidden) return
      let revs
      try {
        revs = await request(`${VAULT_URL}/revisions`, 'GET').then(jsonOrThrow)
      } catch (err) { return }
      if (cancelled) return
      const next = { received: toRevMap(revs.received), owned: toRevMap(revs.owned) }
      if (!seeded) { revsRef.current = next; seeded = true; return }
      const base = revsRef.current
      diff(revs.received, base.received, changedRef.current.received, true)
      diff(revs.owned, base.owned, changedRef.current.owned, false)
      revsRef.current = next
      if (changedRef.current.received.size > 0 || changedRef.current.owned.size > 0) {
        setUpdatesAvailable(true)
      }
    }

    poll() // seed baseline immediately
    const interval = setInterval(poll, 12000)
    const onVisible = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, VAULT_URL])

  // ---- Version history (audit log) ----
  //
  // Owner-only reads. Records hold only ciphertext snapshots + ids/actor/
  // timestamp; the values are decrypted here, client-side. `q` is an optional
  // query string (e.g. '?before=..&limit=..') for pagination.
  const getAudit = useCallback((q = '') => request(`${VAULT_URL}/audit${q}`, 'GET').then(jsonOrThrow), [VAULT_URL])
  const getItemHistory = useCallback((id, q = '') => request(`${VAULT_URL}/audit/item/${id}${q}`, 'GET').then(jsonOrThrow), [VAULT_URL])
  const getFolderHistory = useCallback((id, q = '') => request(`${VAULT_URL}/audit/folder/${id}${q}`, 'GET').then(jsonOrThrow), [VAULT_URL])
  // Version history for an entry in a folder shared WITH me (owner-gated + redacted
  // server-side). Snapshots come back as ciphertext I decrypt with the folder key.
  const getSharedItemHistory = useCallback((ownerId, id, q = '') => request(`${VAULT_URL}/shared/${ownerId}/audit/item/${id}${q}`, 'GET').then(jsonOrThrow), [VAULT_URL])

  // Decrypt one audit record's snapshot into readable fields, reusing the same
  // key resolution as loadEntries (vault key first, folder key fallback for
  // recipient-created data). Returns null when there is no snapshot (e.g. a pure
  // move) or it can't be read.
  const decryptSnapshot = useCallback(async (record) => {
    const vaultKey = vaultKeyRef.current
    if (!vaultKey || !record || !record.snapshot) return null
    const snap = record.snapshot
    try {
      if (record.targetType === 'folder') {
        if (snap.ciphertext) return await decryptFolder(vaultKey, snap)
        const fk = await subtreeKeyForFolder(record.targetId)
        if (fk && snap.sharedName) return await decryptFolderName(fk, snap.sharedName)
        return null
      }
      // item
      if (snap.wrappedItemKey) {
        try { return await decryptItem(vaultKey, snap) } catch (err) { /* stale vault-key copy — try folder key */ }
      }
      if (snap.folderWrappedItemKey) {
        const fk = await subtreeKeyForFolder(snap.folderId)
        if (fk) return await decryptItemWithFolderKey(fk, snap)
      }
    } catch (err) { /* unreadable */ }
    return null
  }, [subtreeKeyForFolder])

  // Decrypt an audit snapshot for a folder shared WITH me, using the recipient's
  // folder key (kept in sharedKeysRef, keyed by the share-root folderId). Only the
  // folder-key copy of the snapshot is usable here — a snapshot from before the
  // folder was shared has no folderWrappedItemKey and returns null (correct: not
  // readable to the recipient).
  const decryptSharedSnapshot = useCallback(async (record, rootFolderId) => {
    const folderKey = sharedKeysRef.current.get(rootFolderId)
    if (!folderKey || !record || !record.snapshot) return null
    const snap = record.snapshot
    try {
      if (record.targetType === 'folder') {
        if (snap.sharedName) return await decryptFolderName(folderKey, snap.sharedName)
        return null
      }
      if (snap.folderWrappedItemKey) return await decryptItemWithFolderKey(folderKey, snap)
    } catch (err) { /* unreadable */ }
    return null
  }, [])

  const value = {
    status,
    items,
    folders,
    error,
    createVault,
    unlock,
    lock,
    saveItem,
    deleteItem,
    deleteItems,
    moveItems,
    saveFolder,
    deleteFolder,
    reorderFolders,
    importItems,
    changeMasterPassword,
    // Settings (server-synced, non-secret)
    settings,
    updateSettings,
    // Sharing
    sharedFolders,
    sharedItems,
    sharedTreeFolders,
    sharedTrees,
    myShares,
    shareFolder,
    revokeShare,
    repairFolderSharing,
    loadMyShares,
    loadSharedWithMe,
    loadSharedTrees,
    openSharedFolder,
    saveSharedItem,
    moveSharedItems,
    importSharedItems,
    // Real-time sync
    updatesAvailable,
    applyUpdates,
    // Version history (audit log)
    getAudit,
    getItemHistory,
    getFolderHistory,
    getSharedItemHistory,
    decryptSnapshot,
    decryptSharedSnapshot
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export const useVault = () => {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider')
  }
  return context
}
