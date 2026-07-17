import { randomUUID } from 'crypto'
import { db } from '../client/firestoreClient.js'

// Zero-knowledge vault storage. The server only ever stores opaque ciphertext
// produced client-side; it never sees plaintext passwords or the master
// password. Ownership is enforced structurally: everything for a user lives
// under vaults/{userId}, so there is no way to read another user's data.
const VAULTS = 'vaults'

const vaultRef = (userId) => db.collection(VAULTS).doc(userId)
const itemsRef = (userId) => vaultRef(userId).collection('items')
const foldersRef = (userId) => vaultRef(userId).collection('folders')

const httpError = (status, message) => {
  const err = new Error(message)
  err.status = status
  return err
}

const assert = (cond, message) => {
  if (!cond) throw httpError(400, message)
}

// A ciphertext blob is { iv, ct } — both base64 strings. Cap sizes so a caller
// can't stuff arbitrarily large payloads into Firestore.
const isCipher = (c) =>
  c && typeof c.iv === 'string' && typeof c.ct === 'string' &&
  c.iv.length > 0 && c.iv.length <= 256 &&
  c.ct.length > 0 && c.ct.length <= 200000

// ---- Vault metadata ----

export const getVault = async (userId) => {
  const doc = await vaultRef(userId).get()
  if (!doc.exists) return null
  const data = doc.data()
  return {
    kdf: data.kdf,
    protectedVaultKey: data.protectedVaultKey,
    createdAt: data.createdAt
  }
}

export const initVault = async (userId, body = {}) => {
  const { kdf, protectedVaultKey } = body
  assert(kdf && typeof kdf.algo === 'string' && typeof kdf.salt === 'string', 'Invalid kdf parameters')
  assert(isCipher(protectedVaultKey), 'Invalid protectedVaultKey')

  const ref = vaultRef(userId)
  const existing = await ref.get()
  if (existing.exists) throw httpError(409, 'Vault already exists')

  const now = Date.now()
  await ref.set({ userId, kdf, protectedVaultKey, createdAt: now, updatedAt: now })
  return { kdf, protectedVaultKey, createdAt: now }
}

// Master-password change: re-wraps the vault key (and updates kdf salt/params).
// Item ciphertext is unaffected because items are encrypted with the vault key,
// not the master key.
export const rotateVaultKey = async (userId, body = {}) => {
  const { kdf, protectedVaultKey } = body
  assert(kdf && typeof kdf.algo === 'string' && typeof kdf.salt === 'string', 'Invalid kdf parameters')
  assert(isCipher(protectedVaultKey), 'Invalid protectedVaultKey')

  const ref = vaultRef(userId)
  const existing = await ref.get()
  if (!existing.exists) throw httpError(404, 'Vault not found')

  await ref.update({ kdf, protectedVaultKey, updatedAt: Date.now() })
  return { kdf, protectedVaultKey }
}

// ---- Items ----

const validateItem = (item = {}) => {
  assert(isCipher(item.ciphertext), 'Invalid item ciphertext')
  assert(isCipher(item.wrappedItemKey), 'Invalid wrappedItemKey')
  assert(item.folderId == null || typeof item.folderId === 'string', 'Invalid folderId')
}

const itemRecord = (item, { withCreatedAt } = {}) => {
  const now = Date.now()
  const record = {
    folderId: item.folderId || null,
    wrappedItemKey: item.wrappedItemKey,
    ciphertext: item.ciphertext,
    updatedAt: now
  }
  if (withCreatedAt) record.createdAt = now
  return record
}

export const listItems = async (userId) => {
  const snap = await itemsRef(userId).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createItem = async (userId, item) => {
  validateItem(item)
  const id = item.id || randomUUID()
  const record = itemRecord(item, { withCreatedAt: true })
  await itemsRef(userId).doc(id).set(record)
  return { id, ...record }
}

export const updateItem = async (userId, id, item) => {
  validateItem(item)
  const ref = itemsRef(userId).doc(id)
  const existing = await ref.get()
  if (!existing.exists) throw httpError(404, 'Item not found')
  const record = itemRecord(item)
  await ref.update(record)
  return { id, ...record }
}

export const deleteItem = async (userId, id) => {
  await itemsRef(userId).doc(id).delete()
}

// Bulk-moves items to a folder (or to no folder when folderId is null). Only the
// plaintext folderId is changed — the encrypted content is never touched.
export const moveItems = async (userId, ids, folderId) => {
  assert(Array.isArray(ids) && ids.length > 0, 'Expected a non-empty array of item ids')
  assert(ids.length <= 2000, 'Too many items in one move')
  ids.forEach((id) => assert(typeof id === 'string', 'Invalid item id'))
  assert(folderId == null || typeof folderId === 'string', 'Invalid folderId')

  const now = Date.now()
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch()
    for (const id of ids.slice(i, i + 400)) {
      batch.update(itemsRef(userId).doc(id), { folderId: folderId || null, updatedAt: now })
    }
    await batch.commit()
  }
  return { success: true }
}

// Bulk create for KeePass import. Firestore batches cap at 500 writes.
export const bulkCreateItems = async (userId, items) => {
  assert(Array.isArray(items) && items.length > 0, 'Expected a non-empty array of items')
  assert(items.length <= 2000, 'Too many items in one import (max 2000)')
  items.forEach(validateItem)

  const created = []
  for (let i = 0; i < items.length; i += 400) {
    const chunk = items.slice(i, i + 400)
    const batch = db.batch()
    for (const item of chunk) {
      const id = item.id || randomUUID()
      const record = itemRecord(item, { withCreatedAt: true })
      batch.set(itemsRef(userId).doc(id), record)
      created.push({ id, ...record })
    }
    await batch.commit()
  }
  return created
}

// ---- Folders ----

const validateFolder = (folder = {}) => {
  assert(isCipher(folder.ciphertext), 'Invalid folder ciphertext')
  assert(folder.parentId == null || typeof folder.parentId === 'string', 'Invalid parentId')
}

export const listFolders = async (userId) => {
  const snap = await foldersRef(userId).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const createFolder = async (userId, folder) => {
  validateFolder(folder)
  const id = folder.id || randomUUID()
  const now = Date.now()
  const record = {
    parentId: folder.parentId || null,
    ciphertext: folder.ciphertext,
    position: typeof folder.position === 'number' ? folder.position : null,
    createdAt: now,
    updatedAt: now
  }
  await foldersRef(userId).doc(id).set(record)
  return { id, ...record }
}

// Batch-updates the parent and ordering of folders (used for drag-and-drop
// reorder / re-parent). Only parentId + position are touched, so the encrypted
// name is never rewritten.
export const reorderFolders = async (userId, updates) => {
  assert(Array.isArray(updates) && updates.length > 0, 'Expected a non-empty array of folder updates')
  assert(updates.length <= 1000, 'Too many folder updates')
  updates.forEach((u) => {
    assert(u && typeof u.id === 'string', 'Invalid folder id')
    assert(u.parentId == null || typeof u.parentId === 'string', 'Invalid parentId')
    assert(typeof u.position === 'number', 'Invalid position')
  })
  const now = Date.now()
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch()
    for (const u of updates.slice(i, i + 400)) {
      batch.update(foldersRef(userId).doc(u.id), {
        parentId: u.parentId || null,
        position: u.position,
        updatedAt: now
      })
    }
    await batch.commit()
  }
  return { success: true }
}

export const updateFolder = async (userId, id, folder) => {
  validateFolder(folder)
  const ref = foldersRef(userId).doc(id)
  const existing = await ref.get()
  if (!existing.exists) throw httpError(404, 'Folder not found')
  const record = { parentId: folder.parentId || null, ciphertext: folder.ciphertext, updatedAt: Date.now() }
  await ref.update(record)
  return { id, ...record }
}

// Deleting a folder removes it and all of its descendant folders. Items in any
// of those folders are detached (moved to "no folder") rather than deleted, so
// no passwords are lost. Writes are chunked to respect Firestore's 500-op batch
// limit.
export const deleteFolder = async (userId, id) => {
  const foldersSnap = await foldersRef(userId).get()
  const childrenByParent = new Map()
  foldersSnap.docs.forEach((d) => {
    const pid = d.data().parentId || null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(d.id)
  })

  // Collect the folder plus every descendant.
  const subtree = new Set()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()
    if (subtree.has(cur)) continue
    subtree.add(cur)
    for (const child of (childrenByParent.get(cur) || [])) stack.push(child)
  }

  const itemsSnap = await itemsRef(userId).get()
  const ops = []
  itemsSnap.docs.forEach((d) => {
    if (subtree.has(d.data().folderId)) {
      ops.push((b) => b.update(d.ref, { folderId: null, updatedAt: Date.now() }))
    }
  })
  subtree.forEach((fid) => ops.push((b) => b.delete(foldersRef(userId).doc(fid))))

  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch()
    ops.slice(i, i + 400).forEach((op) => op(batch))
    await batch.commit()
  }
}
