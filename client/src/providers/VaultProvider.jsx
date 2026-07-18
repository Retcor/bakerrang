import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
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
  encryptFolderName,
  decryptFolderName
} from '../utils/crypto.js'

const VaultContext = createContext()

const AUTO_LOCK_MS = 15 * 60 * 1000 // lock after 15 minutes of inactivity

// status: 'loading' | 'uninitialized' | 'locked' | 'unlocked'
export const VaultProvider = ({ children }) => {
  // Computed inside the component (not at module scope) to avoid a temporal
  // dead zone from the App.jsx <-> providers circular import.
  const VAULT_URL = `${SERVER_PREFIX}/vault`

  const [status, setStatus] = useState('loading')
  const [items, setItems] = useState([])
  const [folders, setFolders] = useState([])
  const [error, setError] = useState(null)
  // Sharing (Phase 2)
  const [sharedFolders, setSharedFolders] = useState([]) // folders shared WITH me
  const [sharedItems, setSharedItems] = useState([]) // entries in the open shared subtree
  const [sharedTreeFolders, setSharedTreeFolders] = useState([]) // its descendant folders
  const [myShares, setMyShares] = useState([]) // shares I have granted

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
    setStatus('locked')
  }, [])

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
    // The folder key covering a folder = the key on its nearest shared ancestor
    // (one key covers a whole shared subtree).
    const subtreeKey = async (folderId) => {
      let cur = rawById.get(folderId)
      const guard = new Set()
      while (cur && !guard.has(cur.id)) {
        guard.add(cur.id)
        if (cur.wrappedFolderKey) return ownerFolderKey(vaultKey, cur)
        cur = cur.parentId ? rawById.get(cur.parentId) : null
      }
      return null
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
    let cur = byId.get(folderId)
    const guard = new Set()
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id)
      if (cur.wrappedFolderKey) return ownerFolderKey(vaultKey, cur)
      cur = cur.parentId ? byId.get(cur.parentId) : null
    }
    return null
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
    const roots = rawFoldersRef.current.filter((r) => r.wrappedFolderKey)
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
    loadSharedWithMe().catch(() => {})
    repairSharedSubtrees(vaultKey).catch(() => {})
  }, [refreshMeta, loadEntries, ensureKeypair, loadMyShares, loadSharedWithMe, repairSharedSubtrees])

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
    const encrypted = folderKey
      ? await encryptItemForFolder(vaultKey, folderKey, content)
      : await encryptItem(vaultKey, content)
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

    let result
    setFolders((prev) => {
      const existing = prev.find((f) => f.id === saved.id)
      // Preserve ordering: the rename response doesn't echo position.
      const position = typeof saved.position === 'number'
        ? saved.position
        : (existing ? existing.position : null)
      const merged = { id: saved.id, parentId: saved.parentId || null, position, name: folder.name || '' }
      result = merged
      const idx = prev.findIndex((f) => f.id === merged.id)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = merged; return copy }
      return [...prev, merged]
    })
    // Mirror the raw record (keeps the shared-subtree walk correct).
    const prevRaw = rawFoldersRef.current.find((r) => r.id === saved.id) || {}
    upsertRawFolder({
      ...prevRaw,
      id: saved.id,
      parentId: saved.parentId || null,
      position: typeof saved.position === 'number' ? saved.position : (prevRaw.position ?? null),
      ...encrypted,
      ...(sharedName ? { sharedName } : {})
    })
    return result
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

  // Load + decrypt a shared folder's WHOLE subtree: every descendant folder and
  // every entry inside it, at any depth. One folder key opens all of it.
  const openSharedFolder = useCallback(async (shared) => {
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

    setSharedItems(decItems)
    setSharedTreeFolders(decFolders)
    return { items: decItems, folders: decFolders }
  }, [])

  // Create a subfolder inside a shared subtree (needs 'edit'). The name is
  // encrypted with the folder key so the owner and other recipients can read it.
  const createSharedFolder = useCallback(async (shared, parentId, name) => {
    const folderKey = sharedKeysRef.current.get(shared.folderId)
    if (!folderKey) throw new Error('Missing folder key for this shared folder')
    const sharedName = await encryptFolderName(folderKey, name)
    const saved = await request(`${VAULT_URL}/shared/${shared.ownerId}/folders`, 'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ parentId: parentId || shared.folderId, sharedName })).then(jsonOrThrow)
    const created = { id: saved.id, parentId: saved.parentId, position: saved.position, name }
    setSharedTreeFolders((prev) => [...prev, created])
    return created
  }, [])

  // Move entries between folders inside a shared subtree (needs 'edit'). The
  // folder key is the same throughout, so the wrapped key doesn't change.
  const moveSharedItems = useCallback(async (shared, ids, folderId) => {
    const updates = ids.map((id) => ({ id, folderId }))
    await request(`${VAULT_URL}/shared/${shared.ownerId}/items/move`, 'PUT',
      { 'Content-Type': 'application/json' }, JSON.stringify({ updates })).then(jsonOrThrow)
    setSharedItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, folderId } : i)))
  }, [])

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
    return newItems
  }, [])

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
    const targetFolder = targetFolderId || item.folderId || shared.folderId
    const saved = item.id
      ? await request(`${VAULT_URL}/shared/${shared.ownerId}/items/${item.id}`, 'PUT', headers, body).then(jsonOrThrow)
      : await request(`${VAULT_URL}/shared/${shared.ownerId}/folders/${targetFolder}/items`, 'POST', headers, body).then(jsonOrThrow)

    const merged = { id: saved.id, folderId: saved.folderId || targetFolder, updatedAt: saved.updatedAt, ...content }
    setSharedItems((prev) => {
      const idx = prev.findIndex((i) => i.id === merged.id)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = merged; return copy }
      return [...prev, merged]
    })
    return merged
  }, [])

  // Share one of my folders with another user by email.
  const shareFolder = useCallback(async (folderId, recipientEmail, permission) => {
    const vaultKey = requireKey()
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) throw new Error('Folder not found')

    // Recipient must already have a vault (server returns a clear error if not).
    const { publicKey } = await request(
      `${VAULT_URL}/pubkey?email=${encodeURIComponent(recipientEmail)}`, 'GET').then(jsonOrThrow)
    const recipientKey = await importPublicKey(publicKey)

    // Sharing is recursive: prepare the WHOLE subtree (every descendant folder's
    // name and every entry's content key) against one folder key.
    const folderKeyRaw = folder.wrappedFolderKey
      ? await unwrapFolderKeyFromVault(vaultKey, folder.wrappedFolderKey)
      : generateFolderKeyRaw()
    const folderKey = await importFolderKey(folderKeyRaw)
    folderKeysRef.current.set(folderId, folderKey)

    const wrappedFolderKey = folder.wrappedFolderKey || await wrapFolderKeyForVault(vaultKey, folderKeyRaw)
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

  // Inactivity auto-lock while unlocked.
  useEffect(() => {
    if (status !== 'unlocked') return
    const resetTimer = () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
      lockTimerRef.current = setTimeout(lock, AUTO_LOCK_MS)
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer))
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    }
  }, [status, lock])

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
    moveItems,
    saveFolder,
    deleteFolder,
    reorderFolders,
    importItems,
    changeMasterPassword,
    // Sharing
    sharedFolders,
    sharedItems,
    sharedTreeFolders,
    myShares,
    shareFolder,
    revokeShare,
    loadMyShares,
    loadSharedWithMe,
    openSharedFolder,
    saveSharedItem,
    createSharedFolder,
    moveSharedItems,
    importSharedItems
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
