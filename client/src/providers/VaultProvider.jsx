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
  decryptFolder
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

  // The live vault key is kept in a ref, never in React state, so it is never
  // serialized into the component tree or persisted anywhere.
  const vaultKeyRef = useRef(null)
  const metaRef = useRef(null)
  const lockTimerRef = useRef(null)

  const jsonOrThrow = async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Request failed (${res.status})`)
    }
    return res.json()
  }

  const lock = useCallback(() => {
    vaultKeyRef.current = null
    setItems([])
    setFolders([])
    setError(null)
    setStatus((prev) => (prev === 'uninitialized' || prev === 'loading' ? prev : 'locked'))
  }, [])

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

  // Decrypt everything for the open vault into local state.
  const loadEntries = useCallback(async (vaultKey) => {
    const [rawItems, rawFolders] = await Promise.all([
      request(`${VAULT_URL}/items`, 'GET').then(jsonOrThrow),
      request(`${VAULT_URL}/folders`, 'GET').then(jsonOrThrow)
    ])
    const decItems = await Promise.all(rawItems.map(async (r) => ({
      id: r.id,
      folderId: r.folderId || null,
      updatedAt: r.updatedAt,
      ...(await decryptItem(vaultKey, r))
    })))
    const decFolders = await Promise.all(rawFolders.map(async (r) => ({
      id: r.id,
      parentId: r.parentId || null,
      position: typeof r.position === 'number' ? r.position : null,
      ...(await decryptFolder(vaultKey, r))
    })))
    setItems(decItems)
    setFolders(decFolders)
  }, [])

  const createVault = useCallback(async (masterPassword) => {
    const { kdf, protectedVaultKey, vaultKey } = await cryptoCreateVault(masterPassword)
    await request(VAULT_URL, 'POST', { 'Content-Type': 'application/json' },
      JSON.stringify({ kdf, protectedVaultKey })).then(jsonOrThrow)
    metaRef.current = { kdf, protectedVaultKey }
    vaultKeyRef.current = vaultKey
    setItems([])
    setFolders([])
    setStatus('unlocked')
  }, [])

  const unlock = useCallback(async (masterPassword) => {
    if (!metaRef.current) await refreshMeta()
    // Throws on wrong password (GCM tag failure) — no server round-trip needed.
    const vaultKey = await unlockVault(masterPassword, metaRef.current)
    await loadEntries(vaultKey)
    vaultKeyRef.current = vaultKey
    setStatus('unlocked')
  }, [refreshMeta, loadEntries])

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
    const encrypted = await encryptItem(vaultKey, content)
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
    return merged
  }, [])

  const deleteItem = useCallback(async (id) => {
    await request(`${VAULT_URL}/items/${id}`, 'DELETE').then(jsonOrThrow)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const moveItems = useCallback(async (ids, folderId) => {
    await request(`${VAULT_URL}/items/move`, 'PUT', { 'Content-Type': 'application/json' },
      JSON.stringify({ ids, folderId: folderId || null })).then(jsonOrThrow)
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, folderId: folderId || null } : i)))
  }, [])

  const saveFolder = useCallback(async (folder) => {
    const vaultKey = requireKey()
    const encrypted = await encryptFolder(vaultKey, { name: folder.name || '' })
    const body = JSON.stringify({ parentId: folder.parentId || null, ...encrypted })
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
    return result
  }, [])

  const reorderFolders = useCallback(async (updates) => {
    await request(`${VAULT_URL}/folders/reorder`, 'PUT',
      { 'Content-Type': 'application/json' }, JSON.stringify({ updates })).then(jsonOrThrow)
    setFolders((prev) => prev.map((f) => {
      const u = updates.find((x) => x.id === f.id)
      return u ? { ...f, parentId: u.parentId || null, position: u.position } : f
    }))
  }, [])

  const deleteFolder = useCallback(async (id) => {
    await request(`${VAULT_URL}/folders/${id}`, 'DELETE').then(jsonOrThrow)
    setFolders((prev) => prev.filter((f) => f.id !== id))
    // Items in that folder were detached server-side; reflect that locally.
    setItems((prev) => prev.map((i) => (i.folderId === id ? { ...i, folderId: null } : i)))
  }, [])

  // Bulk import (KeePass). entries: [{ folderId, title, username, password, url, notes }]
  const importItems = useCallback(async (entries) => {
    const vaultKey = requireKey()
    const payload = await Promise.all(entries.map(async (e) => {
      const content = {
        title: e.title || '',
        username: e.username || '',
        password: e.password || '',
        url: e.url || '',
        notes: e.notes || ''
      }
      const encrypted = await encryptItem(vaultKey, content)
      return { folderId: e.folderId || null, ...encrypted, _content: content }
    }))
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
    return newItems
  }, [])

  const changeMasterPassword = useCallback(async (newPassword) => {
    const vaultKey = requireKey()
    const { kdf, protectedVaultKey } = await rewrapVaultKey(newPassword, vaultKey)
    await request(`${VAULT_URL}/key`, 'PUT', { 'Content-Type': 'application/json' },
      JSON.stringify({ kdf, protectedVaultKey })).then(jsonOrThrow)
    metaRef.current = { kdf, protectedVaultKey }
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
    changeMasterPassword
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
