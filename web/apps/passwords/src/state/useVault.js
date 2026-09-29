import { useCallback, useEffect, useRef, useState } from 'react'
import { vaultApi, vaultRequest } from '../api/vault.js'
import {
  createVault, unlockVault, encryptItem, decryptItem, encryptItemForFolder, decryptItemWithFolderKey,
  encryptFolder, decryptFolder, decryptFolderName, encryptFolderName, reencryptItemKeepingKey,
  unwrapFolderKeyFromVault, unwrapKeyFromSender, importFolderKey, generateFolderKeyRaw,
  wrapFolderKeyForVault, importPublicKey, wrapKeyForRecipient, rewrapItemKeyForFolder
} from '../vault/crypto.js'
import { buildIndexEntry } from '../vault/index.js'
import { ensureKeypair } from '../vault/keypair.js'
import { UnsupportedKdfError } from '../vault/kdf.js'

const defaultSettings = { autoLockMs: 28800000, inlineAutofill: true }
const entryKey = (entry) => `${entry.source}:${entry.id}`
const IMPORT_CHUNK = 500

export const useVault = (active) => {
  const [status, setStatus] = useState('META_LOADING')
  const [index, setIndex] = useState([])
  const [folders, setFolders] = useState([])
  const [shared, setShared] = useState([])
  const [myShares, setMyShares] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [sharingReady, setSharingReady] = useState(true)
  const [updatesAvailable, setUpdatesAvailable] = useState(false)
  const [error, setError] = useState('')
  const epoch = useRef(0)
  const abort = useRef(null)
  const vaultKey = useRef(null)
  const privateKey = useRef(null)
  const meta = useRef(null)
  const records = useRef(new Map())
  const rawFolders = useRef([])
  const sharedKeys = useRef(new Map())
  const ownedFolderKeys = useRef(new Map())
  const lastActivity = useRef(Date.now())
  const revisionBaseline = useRef(null)
  const loadSequence = useRef(0)
  const lastLoadedAt = useRef(0)

  const current = (token) => token === epoch.current && vaultKey.current !== null
  const lock = useCallback(() => {
    epoch.current++
    abort.current?.abort()
    abort.current = null
    vaultKey.current = null
    privateKey.current = null
    records.current = new Map()
    rawFolders.current = []
    sharedKeys.current = new Map()
    ownedFolderKeys.current = new Map()
    revisionBaseline.current = null
    loadSequence.current++
    setIndex([])
    setFolders([])
    setShared([])
    setMyShares([])
    setUpdatesAvailable(false)
    setError('')
    setStatus('LOCKED')
  }, [])

  const loadMeta = useCallback(async () => {
    const token = ++epoch.current
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setStatus('META_LOADING')
    try {
      const loaded = await vaultApi.meta(controller.signal)
      if (token !== epoch.current) return
      meta.current = loaded
      setSettings({ ...defaultSettings, ...(loaded.settings || {}) })
      setStatus('LOCKED')
    } catch (failure) {
      if (token !== epoch.current) return
      setStatus(failure.status === 404 ? 'NO_VAULT' : 'META_FAILED')
    }
  }, [])

  useEffect(() => { if (active) loadMeta(); else lock() }, [active, loadMeta, lock])

  const ownerFolderKey = useCallback(async (folderId) => {
    const token = epoch.current
    const byId = new Map(rawFolders.current.map((folder) => [folder.id, folder]))
    const ancestors = []
    let next = folderId
    const seen = new Set()
    while (next && !seen.has(next)) {
      seen.add(next)
      const folder = byId.get(next)
      if (!folder) break
      if (folder.wrappedFolderKey) ancestors.push(folder)
      next = folder.parentId
    }
    const root = ancestors.at(-1)
    if (!root) return null
    if (ownedFolderKeys.current.has(root.id)) return ownedFolderKeys.current.get(root.id)
    const raw = await unwrapFolderKeyFromVault(vaultKey.current, root.wrappedFolderKey)
    try {
      const key = await importFolderKey(raw)
      if (!current(token)) throw new Error('Vault locked')
      ownedFolderKeys.current.set(root.id, key)
      return key
    } finally { raw.fill(0) }
  }, [])

  const decryptRecord = useCallback(async (record, source = 'owned') => {
    const folderKey = source === 'owned' ? await ownerFolderKey(record.folderId) : sharedKeys.current.get(source)
    if (source === 'owned' && record.wrappedItemKey) {
      try { return await decryptItem(vaultKey.current, record) } catch { /* recipient edits can invalidate the owner copy */ }
    }
    if (folderKey && record.folderWrappedItemKey) return decryptItemWithFolderKey(folderKey, record)
    throw new Error('Entry cannot be opened')
  }, [ownerFolderKey])

  const reload = useCallback(async (token = epoch.current) => {
    const sequence = ++loadSequence.current
    const signal = abort.current?.signal
    const [items, ownerFolders] = await Promise.all([vaultApi.items(signal), vaultApi.folders(signal)])
    if (!current(token) || sequence !== loadSequence.current) return
    rawFolders.current = ownerFolders
    ownedFolderKeys.current = new Map()
    sharedKeys.current = new Map()
    const displayFolders = await Promise.all(ownerFolders.map(async (folder) => {
      try {
        const name = (await decryptFolder(vaultKey.current, folder)).name
        return { id: folder.id, parentId: folder.parentId, position: folder.position, name, rev: folder.rev, source: 'owned', shared: folder.shared }
      } catch {
        try {
          const key = await ownerFolderKey(folder.id)
          return { id: folder.id, parentId: folder.parentId, position: folder.position, name: (await decryptFolderName(key, folder.sharedName)).name, rev: folder.rev, source: 'owned', shared: folder.shared }
        } catch { return { id: folder.id, parentId: folder.parentId, position: folder.position, name: "Can't open folder", rev: folder.rev, source: 'owned', shared: folder.shared } }
      }
    }))
    if (!current(token) || sequence !== loadSequence.current) return
    const allRecords = new Map(items.map((record) => [`owned:${record.id}`, record]))
    const ownIndex = await Promise.all(items.map(async (record) => buildIndexEntry(record, { vaultKey: vaultKey.current, folderKey: await ownerFolderKey(record.folderId) })))
    if (!current(token) || sequence !== loadSequence.current) return
    let received = []
    let ownedShares = []
    const sharedFolders = []
    const sharedIndex = []
    if (privateKey.current) {
      [received, ownedShares] = await Promise.all([vaultApi.shared(signal), vaultApi.shares(signal)])
      for (const share of received) {
        const raw = await unwrapKeyFromSender(share.wrappedFolderKey, privateKey.current)
        let key
        try { key = await importFolderKey(raw) } finally { raw.fill(0) }
        if (!current(token) || sequence !== loadSequence.current) return
        const source = `shared:${share.ownerId}:${share.shareId}`
        sharedKeys.current.set(source, key)
        const tree = await vaultApi.sharedTree(share.ownerId, share.folderId, signal)
        if (!current(token) || sequence !== loadSequence.current) return
        for (const folder of tree.folders) {
          let name = "Can't open folder"
          try { name = (await decryptFolderName(key, folder.sharedName)).name } catch { /* display the safe fallback */ }
          sharedFolders.push({ id: folder.id, parentId: folder.parentId, position: folder.position, name, rev: folder.rev, source, shared: true })
        }
        for (const record of tree.items) {
          allRecords.set(`${source}:${record.id}`, record)
          sharedIndex.push(await buildIndexEntry(record, { folderKey: key, source }))
        }
      }
    }
    if (!current(token) || sequence !== loadSequence.current) return
    records.current = allRecords
    setIndex([...ownIndex, ...sharedIndex])
    setFolders([...displayFolders, ...sharedFolders])
    setShared(received)
    setMyShares(ownedShares)
    setUpdatesAvailable(false)
    lastLoadedAt.current = Date.now()
  }, [ownerFolderKey])

  const finishUnlock = useCallback(async (key, loadedMeta, token) => {
    vaultKey.current = key
    meta.current = loadedMeta
    abort.current?.abort()
    abort.current = new AbortController()
    try {
      const pair = await ensureKeypair(key, loadedMeta, abort.current.signal)
      if (!current(token)) return
      privateKey.current = pair.privateKey
      meta.current = pair.meta
      setSharingReady(true)
    } catch {
      if (!current(token)) return
      privateKey.current = null
      setSharingReady(false)
    }
    try {
      await reload(token)
      if (current(token)) { lastActivity.current = Date.now(); setStatus('UNLOCKED') }
    } catch {
      if (current(token)) { lock(); setStatus('META_FAILED') }
    }
  }, [lock, reload])

  const unlock = useCallback(async (masterPassword) => {
    const token = ++epoch.current
    setStatus('UNLOCKING')
    try {
      const key = await unlockVault(masterPassword, meta.current)
      if (token !== epoch.current) return
      await finishUnlock(key, meta.current, token)
    } catch (failure) {
      if (token === epoch.current) { setStatus('LOCKED'); setError(failure instanceof UnsupportedKdfError ? failure.message : 'Could not unlock this vault. Check your master password.') }
    }
  }, [finishUnlock])

  const create = useCallback(async (masterPassword) => {
    const token = ++epoch.current
    setStatus('UNLOCKING')
    try {
      const created = await createVault(masterPassword)
      if (token !== epoch.current) return
      const loaded = await vaultApi.create({ kdf: created.kdf, protectedVaultKey: created.protectedVaultKey, publicKey: created.publicKey, protectedPrivateKey: created.protectedPrivateKey })
      if (token !== epoch.current) return
      await finishUnlock(created.vaultKey, { ...loaded, protectedPrivateKey: created.protectedPrivateKey }, token)
    } catch {
      if (token === epoch.current) { setStatus('NO_VAULT'); setError('The vault could not be created. Try again.') }
    }
  }, [finishUnlock])

  const openEntry = useCallback(async (entry) => {
    const token = epoch.current
    const record = records.current.get(entryKey(entry))
    if (!record) throw new Error('Entry unavailable')
    const fields = await decryptRecord(record, entry.source)
    if (!current(token)) return null
    return { ...fields, record, source: entry.source }
  }, [decryptRecord])

  const saveEntry = useCallback(async ({ fields, record, source, folderId }) => {
    const token = epoch.current
    const folderKey = source === 'owned' ? await ownerFolderKey(folderId) : sharedKeys.current.get(source)
    let encrypted
    if (record && source === 'owned' && record.folderId !== folderId && !record.wrappedItemKey) {
      encrypted = folderKey ? await encryptItemForFolder(vaultKey.current, folderKey, fields) : await encryptItem(vaultKey.current, fields)
    } else if (record) {
      encrypted = await reencryptItemKeepingKey({ vaultKey: source === 'owned' ? vaultKey.current : null, folderKey: source === 'owned' ? await ownerFolderKey(record.folderId) : folderKey, record }, fields)
      if (source === 'owned' && record.folderId !== folderId) {
        encrypted.folderWrappedItemKey = folderKey ? await rewrapItemKeyForFolder(vaultKey.current, folderKey, record) : null
      }
    } else encrypted = folderKey ? await encryptItemForFolder(source === 'owned' ? vaultKey.current : null, folderKey, fields) : await encryptItem(vaultKey.current, fields)
    if (!current(token)) return null
    const ownerId = source.startsWith('shared:') ? source.split(':')[1] : null
    const path = ownerId ? (record ? `/shared/${ownerId}/items/${record.id}` : `/shared/${ownerId}/folders/${folderId}/items`) : (record ? `/items/${record.id}` : '/items')
    const body = ownerId
      ? { ciphertext: encrypted.ciphertext, ...(record ? { expectedRev: record.rev } : { folderWrappedItemKey: encrypted.folderWrappedItemKey }) }
      : { folderId, ...encrypted, ...(record ? { expectedRev: record.rev } : {}) }
    const result = await vaultRequest(path, { method: record ? 'PUT' : 'POST', body, signal: abort.current?.signal })
    if (!current(token)) return null
    await reload(token)
    return result
  }, [ownerFolderKey, reload])

  // KeePass import. Folders are created one request each, entries are encrypted
  // locally and sent through the bulk endpoints, and the vault reloads once at the
  // end — per-entry saves (each followed by a full reload) exhausted the rate limit.
  const importEntries = useCallback(async (entries, { source = 'owned', folderId = null } = {}, onProgress = () => {}) => {
    const token = epoch.current
    const signal = abort.current?.signal
    const fieldsOf = (entry) => ({ title: entry.title || '', username: entry.username || '', password: entry.password || '', url: entry.url || '', notes: entry.notes || '' })
    const send = async (path, items) => {
      for (let start = 0; start < items.length; start += IMPORT_CHUNK) {
        if (!current(token)) return
        onProgress(`Saving ${Math.min(start + IMPORT_CHUNK, items.length)} of ${items.length}…`)
        await vaultRequest(path, { method: 'POST', body: { items: items.slice(start, start + IMPORT_CHUNK) }, signal })
      }
    }
    try {
      if (source !== 'owned') {
        const key = sharedKeys.current.get(source)
        if (!key || !folderId) throw new Error('Shared folder unavailable')
        const items = []
        for (const entry of entries) {
          onProgress(`Encrypting ${items.length + 1} of ${entries.length}…`)
          const encrypted = await encryptItemForFolder(null, key, fieldsOf(entry))
          items.push({ folderId, ciphertext: encrypted.ciphertext, folderWrappedItemKey: encrypted.folderWrappedItemKey })
        }
        await send(`/shared/${source.split(':')[1]}/items/bulk`, items)
        return
      }
      const paths = new Map()
      const targets = []
      for (const entry of entries) {
        let parent = folderId
        for (let depth = 0; depth < entry.path.length; depth++) {
          const pathKey = entry.path.slice(0, depth + 1).join('\u0000')
          if (!paths.has(pathKey)) {
            if (!current(token)) return
            onProgress(`Creating folder ${entry.path[depth]}…`)
            const name = entry.path[depth]
            const folderKey = await ownerFolderKey(parent)
            const encrypted = await encryptFolder(vaultKey.current, { name })
            const sharedName = folderKey ? await encryptFolderName(folderKey, name) : null
            const created = await vaultRequest('/folders', { method: 'POST', body: { ...encrypted, parentId: parent, sharedName }, signal })
            rawFolders.current = [...rawFolders.current, created]
            paths.set(pathKey, created.id)
          }
          parent = paths.get(pathKey)
        }
        targets.push(parent)
      }
      const items = []
      for (const [at, entry] of entries.entries()) {
        if (!current(token)) return
        onProgress(`Encrypting ${at + 1} of ${entries.length}…`)
        const folderKey = await ownerFolderKey(targets[at])
        const fields = fieldsOf(entry)
        const encrypted = folderKey ? await encryptItemForFolder(vaultKey.current, folderKey, fields) : await encryptItem(vaultKey.current, fields)
        items.push({ folderId: targets[at], ...encrypted })
      }
      await send('/items/bulk', items)
    } finally {
      if (current(token)) await reload(token).catch(() => {})
    }
  }, [ownerFolderKey, reload])

  const deleteEntry = useCallback(async (entry) => {
    if (entry.source !== 'owned') return
    const token = epoch.current
    await vaultRequest(`/items/${entry.id}`, { method: 'DELETE', signal: abort.current?.signal })
    if (current(token)) await reload(token)
  }, [reload])

  const createFolder = useCallback(async (name, parentId = null) => {
    const token = epoch.current
    const folderKey = await ownerFolderKey(parentId)
    const encrypted = await encryptFolder(vaultKey.current, { name })
    const sharedName = folderKey ? await encryptFolderName(folderKey, name) : null
    const created = await vaultRequest('/folders', { method: 'POST', body: { ...encrypted, parentId, sharedName }, signal: abort.current?.signal })
    if (current(token)) await reload(token)
    return created
  }, [ownerFolderKey, reload])

  const renameFolder = useCallback(async (folder, name) => {
    const token = epoch.current
    const folderKey = await ownerFolderKey(folder.id)
    const encrypted = await encryptFolder(vaultKey.current, { name })
    const sharedName = folderKey ? await encryptFolderName(folderKey, name) : null
    await vaultRequest(`/folders/${folder.id}`, { method: 'PUT', body: { ...encrypted, sharedName, parentId: folder.parentId, expectedRev: folder.rev }, signal: abort.current?.signal })
    if (current(token)) await reload(token)
  }, [ownerFolderKey, reload])

  const deleteFolder = useCallback(async (folder) => {
    const token = epoch.current
    await vaultRequest(`/folders/${folder.id}`, { method: 'DELETE', signal: abort.current?.signal })
    if (current(token)) await reload(token)
  }, [reload])

  const moveFolder = useCallback(async (folder, parentId, targetIndex) => {
    const token = epoch.current
    const byId = new Map(rawFolders.current.map((record) => [record.id, record]))
    if (!byId.has(folder.id) || (parentId && !byId.has(parentId))) throw new Error('Folder no longer exists')
    const seen = new Set()
    for (let id = parentId; id && !seen.has(id); id = byId.get(id)?.parentId) {
      if (id === folder.id) throw new Error('A folder cannot be moved inside itself')
      seen.add(id)
    }
    const sharingRoot = (id) => {
      const ancestors = []
      const visited = new Set()
      for (let next = id; next && !visited.has(next); next = byId.get(next)?.parentId) {
        visited.add(next)
        if (byId.get(next)?.wrappedFolderKey) ancestors.push(next)
      }
      return ancestors.at(-1) || null
    }
    const oldRoot = sharingRoot(folder.id)
    const newRoot = sharingRoot(parentId)
    if (oldRoot !== newRoot && !(oldRoot === folder.id && !newRoot)) throw new Error('Move within the same sharing area, or repair access first')
    const siblings = rawFolders.current.filter((item) => item.parentId === parentId && item.id !== folder.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const position = Math.max(0, Math.min(Number.isInteger(targetIndex) ? targetIndex : siblings.length, siblings.length))
    siblings.splice(position, 0, byId.get(folder.id))
    const updates = siblings.map((item, index) => ({ id: item.id, parentId, position: index }))
    if (!current(token)) return
    await vaultRequest('/folders/reorder', { method: 'PUT', body: { updates }, signal: abort.current?.signal })
    if (current(token)) await reload(token)
  }, [reload])

  const shareFolder = useCallback(async (folder, email, permission) => {
    const token = epoch.current
    const recipient = await vaultRequest('/pubkey', { method: 'POST', body: { email }, signal: abort.current?.signal })
    const byId = new Map(rawFolders.current.map((record) => [record.id, record]))
    const ancestors = []
    let next = folder.id
    const seen = new Set()
    while (next && !seen.has(next)) {
      seen.add(next)
      const record = byId.get(next)
      if (!record) break
      if (record.wrappedFolderKey) ancestors.push(record)
      next = record.parentId
    }
    const outermost = ancestors.at(-1)
    const raw = outermost ? await unwrapFolderKeyFromVault(vaultKey.current, outermost.wrappedFolderKey) : generateFolderKeyRaw()
    try {
      const key = await importFolderKey(raw)
      const publicKey = await importPublicKey(recipient.publicKey)
      const wrappedFolderKey = await wrapKeyForRecipient(raw, publicKey)
      let folderSetup
      if (!outermost) {
        const subtree = new Set([folder.id])
        let grew = true
        while (grew) {
          grew = false
          for (const record of rawFolders.current) {
            if (subtree.has(record.parentId) && !subtree.has(record.id)) { subtree.add(record.id); grew = true }
          }
        }
        const folderNames = await Promise.all(folders.filter((f) => f.source === 'owned' && subtree.has(f.id)).map(async (f) => ({ id: f.id, sharedName: await encryptFolderName(key, f.name) })))
        const itemKeys = []
        for (const item of index.filter((entry) => entry.source === 'owned' && subtree.has(entry.folderId))) {
          const record = records.current.get(entryKey(item))
          if (record?.wrappedItemKey) itemKeys.push({ id: item.id, folderWrappedItemKey: await rewrapItemKeyForFolder(vaultKey.current, key, record) })
        }
        folderSetup = { wrappedFolderKey: await wrapFolderKeyForVault(vaultKey.current, raw), sharedName: await encryptFolderName(key, folder.name), folderNames, itemKeys }
      }
      if (!current(token)) return
      await vaultRequest('/shares', { method: 'POST', body: { folderId: folder.id, recipientEmail: email, permission, wrappedFolderKey, folderSetup }, signal: abort.current?.signal })
      if (current(token)) await reload(token)
    } finally { raw.fill(0) }
  }, [folders, index, reload])

  const revokeShare = useCallback(async (shareId) => {
    const token = epoch.current
    await vaultRequest(`/shares/${shareId}`, { method: 'DELETE', signal: abort.current?.signal })
    if (current(token)) await reload(token)
  }, [reload])

  const repairFolderSharing = useCallback(async (folderId) => {
    const token = epoch.current
    const byId = new Map(rawFolders.current.map((folder) => [folder.id, folder]))
    const ancestors = []
    const seen = new Set()
    for (let id = folderId; id && !seen.has(id); id = byId.get(id)?.parentId) {
      seen.add(id)
      if (byId.get(id)?.wrappedFolderKey) ancestors.push(id)
    }
    const rootId = ancestors.at(-1)
    if (!rootId) throw new Error('This folder is not shared')
    const key = await ownerFolderKey(rootId)
    const subtree = new Set([rootId])
    let grew = true
    while (grew) {
      grew = false
      for (const folder of rawFolders.current) {
        if (subtree.has(folder.parentId) && !subtree.has(folder.id)) { subtree.add(folder.id); grew = true }
      }
    }
    const folderNames = []
    for (const folder of rawFolders.current.filter((item) => subtree.has(item.id))) {
      let name
      try { name = (await decryptFolder(vaultKey.current, folder)).name } catch {
        try { name = (await decryptFolderName(key, folder.sharedName)).name } catch { /* unreadable stays untouched */ }
      }
      if (name != null) folderNames.push({ id: folder.id, sharedName: await encryptFolderName(key, name) })
    }
    const itemKeys = []
    for (const [recordKey, record] of records.current) {
      if (!recordKey.startsWith('owned:')) continue
      if (!subtree.has(record.folderId) || !record.wrappedItemKey) continue
      try { itemKeys.push({ id: record.id, folderWrappedItemKey: await rewrapItemKeyForFolder(vaultKey.current, key, record) }) } catch { /* recipient-owned key */ }
    }
    if (!current(token)) return null
    await vaultRequest(`/folders/${rootId}/share-setup`, { method: 'PUT', body: { folderNames, itemKeys }, signal: abort.current?.signal })
    if (current(token)) await reload(token)
    return { folders: folderNames.length, items: itemKeys.length }
  }, [ownerFolderKey, reload])

  const retrySharing = useCallback(async () => {
    const token = epoch.current
    try {
      const fresh = await vaultApi.meta(abort.current?.signal)
      const pair = await ensureKeypair(vaultKey.current, fresh, abort.current?.signal)
      if (!current(token)) return
      meta.current = pair.meta
      privateKey.current = pair.privateKey
      setSharingReady(true)
      await reload(token)
    } catch { if (current(token)) setSharingReady(false) }
  }, [reload])

  const updateSettings = useCallback(async (next) => {
    const merged = await vaultRequest('/settings', { method: 'PUT', body: { settings: next }, signal: abort.current?.signal })
    setSettings({ ...defaultSettings, ...merged })
  }, [])

  useEffect(() => {
    if (status !== 'UNLOCKED') return
    const activity = () => { lastActivity.current = Date.now() }
    const check = () => { if (settings.autoLockMs != null && Date.now() - lastActivity.current >= settings.autoLockMs) lock() }
    const hidden = () => { if (document.visibilityState === 'visible') check() }
    const leave = () => lock()
    for (const type of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.addEventListener(type, activity, true)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('focus', check)
    window.addEventListener('pagehide', leave)
    const timer = window.setInterval(check, 15000)
    return () => {
      for (const type of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.removeEventListener(type, activity, true)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('focus', check)
      window.removeEventListener('pagehide', leave)
      window.clearInterval(timer)
    }
  }, [lock, settings.autoLockMs, status])

  useEffect(() => {
    if (status !== 'UNLOCKED') return
    const poll = async () => {
      if (document.visibilityState === 'hidden') return
      const token = epoch.current
      try {
        const next = await vaultApi.revisions(abort.current?.signal)
        if (!current(token)) return
        const baseline = revisionBaseline.current
        const revisionChanged = baseline && ['received', 'owned'].some((side) => Object.entries(next[side] || {}).some(([id, value]) => baseline[side]?.[id] && baseline[side][id].rev !== value.rev && !value.mine))
        const receivedChanged = baseline && (Object.keys(next.received || {}).some((id) => !baseline.received?.[id]) || Object.keys(baseline.received || {}).some((id) => !next.received?.[id]))
        if (revisionChanged || receivedChanged) setUpdatesAvailable(true)
        revisionBaseline.current = next
      } catch { /* polling is best effort */ }
    }
    poll()
    const timer = window.setInterval(poll, 12000)
    return () => window.clearInterval(timer)
  }, [status])

  const refresh = useCallback(async () => { const token = epoch.current; await reload(token); if (current(token)) setUpdatesAvailable(false) }, [reload])

  return {
    status,
    index,
    folders,
    shared,
    myShares,
    settings,
    sharingReady,
    updatesAvailable,
    error,
    loadMeta,
    lock,
    unlock,
    create,
    openEntry,
    saveEntry,
    importEntries,
    deleteEntry,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    shareFolder,
    revokeShare,
    repairFolderSharing,
    refresh,
    retrySharing,
    updateSettings,
    decryptRecord,
    ownerFolderKey,
    rawRecord: (entry) => records.current.get(entryKey(entry)),
    vaultKey: () => vaultKey.current,
    privateKey: () => privateKey.current,
    sharedKey: (source) => sharedKeys.current.get(source),
    rawFolders: () => rawFolders.current,
    lastLoadedAt: () => lastLoadedAt.current
  }
}
