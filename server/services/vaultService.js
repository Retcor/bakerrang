import { randomUUID } from 'crypto'
import { db as firestoreDb, FieldValue } from '../client/firestoreClient.js'
import { cleanVaultKdf } from '../domain/vaultKdf.js'
import { cleanCipherBlob, validVaultId } from '../domain/vaultShapes.js'

let db = firestoreDb
export const _setDb = (testDb) => { db = testDb || firestoreDb }

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
const isCipher = (c) => Boolean(cleanCipherBlob(c))
const cipher = (c, field) => {
  const value = cleanCipherBlob(c)
  assert(value, `Invalid ${field}`)
  return value
}
const revision = (data) => Number.isInteger(data?.rev) ? data.rev : 0
const expectedRevision = (body) => {
  if (body && Object.hasOwn(body, 'expectedRev')) {
    assert(Number.isInteger(body.expectedRev) && body.expectedRev >= 0, 'Invalid expectedRev')
    return body.expectedRev
  }
  return null
}
const conflict = (message, current) => Object.assign(httpError(409, message), { code: 'conflict', current })

// ---- Audit log (version history) ----
//
// Every create/update/delete/move of an OWNED folder or entry is recorded under
// vaults/{ownerId}/audit. Records hold only ciphertext snapshots plus ids /
// actor / timestamp, so history stays zero-knowledge — the values are decrypted
// client-side. Writes are best-effort: callers never await and wrap in
// `.catch(() => {})` so an audit failure can never break the mutation itself.
// `actor` = { id, email } of whoever made the change — the owner for owner ops,
// the share-recipient for shared-side ops (that is what attributes an edit to
// "user X" in the owner's history).
const auditRef = (ownerId) => vaultRef(ownerId).collection('audit')

// A decryptable snapshot of an item — exactly the fields decryptItem() needs
// (wrappedItemKey + ciphertext), plus folderWrappedItemKey so the owner can fall
// back to the folder key for recipient-created entries.
const itemSnapshot = (record) => ({
  wrappedItemKey: record.wrappedItemKey || null,
  ciphertext: record.ciphertext,
  folderWrappedItemKey: record.folderWrappedItemKey || null,
  folderId: record.folderId || null
})
// Folder snapshot — the owner's vault-key-encrypted name (decryptFolder()).
const folderSnapshot = (record) => ({
  ciphertext: record.ciphertext,
  sharedName: record.sharedName || null
})

const auditDoc = (entry, actor, now) => ({
  action: entry.action,
  targetType: entry.targetType,
  targetId: entry.targetId,
  folderId: entry.folderId != null ? entry.folderId : null,
  snapshot: entry.snapshot != null ? entry.snapshot : null,
  meta: entry.meta != null ? entry.meta : null,
  actorId: (actor && actor.id) || null,
  actorEmail: (actor && actor.email) || null,
  createdAt: now
})

// Write one audit entry or an array of them. Batched (Firestore's 500-op cap →
// chunk at 400). Best-effort — see the note above.
export const logAudit = async (ownerId, entries, actor) => {
  const list = Array.isArray(entries) ? entries : [entries]
  if (!list.length) return
  const now = Date.now()
  for (let i = 0; i < list.length; i += 400) {
    const batch = db.batch()
    for (const e of list.slice(i, i + 400)) {
      batch.set(auditRef(ownerId).doc(randomUUID()), auditDoc(e, actor, now))
    }
    await batch.commit()
  }
}

// Reverse-chronological audit records, optionally scoped to one target (an item
// or folder id) or one folder, with a `before` (createdAt ms) cursor for
// pagination. Owner-only — callers pass their own id as ownerId.
// NOTE: the targetId/folderId + orderBy(createdAt) combination needs a Firestore
// composite index; the first such query errors with a one-click create link.
export const listAudit = async (ownerId, { targetId, folderId, limit, before } = {}) => {
  if (limit !== undefined) assert(/^\d+$/.test(String(limit)) && Number(limit) >= 1 && Number(limit) <= 200, 'Invalid query')
  if (before !== undefined) assert(/^\d+$/.test(String(before)) && Number(before) > 0, 'Invalid query')
  let q = auditRef(ownerId).orderBy('createdAt', 'desc')
  if (targetId) q = q.where('targetId', '==', targetId)
  else if (folderId) q = q.where('folderId', '==', folderId)
  if (before) q = q.where('createdAt', '<', Number(before))
  const capped = limit === undefined ? 50 : Number(limit)
  const snap = await q.limit(capped).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ---- Vault metadata ----

export const getVault = async (userId) => {
  const doc = await vaultRef(userId).get()
  if (!doc.exists) return null
  const data = doc.data()
  return {
    kdf: data.kdf,
    protectedVaultKey: data.protectedVaultKey,
    publicKey: data.publicKey || null,
    protectedPrivateKey: data.protectedPrivateKey || null,
    // Plaintext, non-secret preferences (auto-lock duration, inline-autofill
    // toggle). Deliberately readable without unlocking so the browser extension
    // and the web app can honor them; never holds anything derived from a secret.
    settings: data.settings || {},
    createdAt: data.createdAt,
    keyRev: Number.isInteger(data.keyRev) ? data.keyRev : 0
  }
}

// Persists non-secret vault preferences. Partial updates merge into the existing
// settings map. autoLockMs is null (never lock) or a duration in ms bounded to a
// sane range; inlineAutofill is a boolean.
export const updateSettings = async (userId, settings = {}) => {
  assert(settings && typeof settings === 'object', 'Invalid settings')
  const clean = {}

  if ('autoLockMs' in settings) {
    const v = settings.autoLockMs
    assert(
      v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 60000 && v <= 604800000),
      'Invalid autoLockMs'
    )
    clean.autoLockMs = v
  }
  if ('inlineAutofill' in settings) {
    assert(typeof settings.inlineAutofill === 'boolean', 'Invalid inlineAutofill')
    clean.inlineAutofill = settings.inlineAutofill
  }

  const ref = vaultRef(userId)
  const existing = await ref.get()
  if (!existing.exists) throw httpError(404, 'Vault not found')

  const merged = { ...(existing.data().settings || {}), ...clean }
  await ref.set({ settings: merged, updatedAt: Date.now() }, { merge: true })
  return merged
}

export const initVault = async (userId, body = {}) => {
  const { kdf, protectedVaultKey, publicKey, protectedPrivateKey } = body
  const cleanKdf = cleanVaultKdf(kdf)
  assert(cleanKdf, 'Invalid kdf parameters')
  const protectedKey = cipher(protectedVaultKey, 'protectedVaultKey')
  assert((publicKey == null) === (protectedPrivateKey == null), 'Invalid sharing keys')
  if (publicKey != null) {
    assert(typeof publicKey === 'string' && publicKey.length >= 300 && publicKey.length <= 800, 'Invalid publicKey')
  }
  const privateKey = protectedPrivateKey == null ? null : cipher(protectedPrivateKey, 'protectedPrivateKey')

  const ref = vaultRef(userId)
  const now = Date.now()
  const record = { userId, kdf: cleanKdf, protectedVaultKey: protectedKey, keyRev: 0, createdAt: now, updatedAt: now }
  if (privateKey) {
    record.publicKey = publicKey
    record.protectedPrivateKey = privateKey
  }
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref)
    if (existing.exists) throw httpError(409, 'Vault already exists')
    tx.set(ref, record)
  })
  return { kdf: cleanKdf, protectedVaultKey: protectedKey, publicKey: record.publicKey || null, createdAt: now, keyRev: 0 }
}

// Adds/updates the sharing keypair on an existing vault (migration for vaults
// created before Phase 2). The private key is client-encrypted with the vault key.
export const setVaultKeys = async (userId, body = {}) => {
  const { publicKey, protectedPrivateKey } = body
  assert(typeof publicKey === 'string' && publicKey.length >= 300 && publicKey.length <= 800, 'Invalid publicKey')
  const privateKey = cipher(protectedPrivateKey, 'protectedPrivateKey')
  const ref = vaultRef(userId)
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref)
    if (!existing.exists) throw httpError(404, 'Vault not found')
    if (existing.data().publicKey) {
      if (existing.data().publicKey === publicKey) return
      throw Object.assign(httpError(409, 'Sharing keys already set'), { code: 'keys_exist' })
    }
    tx.set(ref, { publicKey, protectedPrivateKey: privateKey, updatedAt: Date.now() }, { merge: true })
  })
  return { publicKey }
}

// Resolves a Gmail address to that user's sharing public key. Requires the
// recipient to already have a vault with a keypair.
export const getPublicKeyByEmail = async (email) => {
  assert(typeof email === 'string' && email.trim().length <= 254 && email.trim().includes('@'), 'Invalid email')
  const normalized = email.trim().toLowerCase()
  const snap = await db.collection('users').where('emailLower', '==', normalized).limit(1).get()
  if (snap.empty) throw httpError(404, 'No BakerRang user with that email')
  const recipientId = snap.docs[0].id
  const vaultDoc = await vaultRef(recipientId).get()
  if (!vaultDoc.exists || !vaultDoc.data().publicKey) {
    throw httpError(409, "That person hasn't set up Passwords yet")
  }
  return { userId: recipientId, email: normalized, publicKey: vaultDoc.data().publicKey }
}

// Master-password change: re-wraps the vault key (and updates kdf salt/params).
// Item ciphertext is unaffected because items are encrypted with the vault key,
// not the master key.
export const rotateVaultKey = async (userId, body = {}) => {
  const { kdf, protectedVaultKey, expectedKeyRev } = body
  const cleanKdf = cleanVaultKdf(kdf)
  assert(cleanKdf, 'Invalid kdf parameters')
  const protectedKey = cipher(protectedVaultKey, 'protectedVaultKey')
  assert(Number.isInteger(expectedKeyRev) && expectedKeyRev >= 0, 'Invalid expectedKeyRev')

  const ref = vaultRef(userId)
  let keyRev
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref)
    if (!existing.exists) throw httpError(404, 'Vault not found')
    const prior = Number.isInteger(existing.data().keyRev) ? existing.data().keyRev : 0
    if (prior !== expectedKeyRev) throw conflict('Vault key changed')
    keyRev = prior + 1
    const now = Date.now()
    tx.set(ref, { kdf: cleanKdf, protectedVaultKey: protectedKey, keyRev, updatedAt: now }, { merge: true })
    tx.set(auditRef(userId).doc(randomUUID()), auditDoc({ action: 'vault.key-change', targetType: 'vault', targetId: userId, snapshot: null }, null, now))
  })
  return { kdf: cleanKdf, protectedVaultKey: protectedKey, keyRev }
}

// ---- Items ----

const validateItem = (item = {}) => {
  assert(isCipher(item.ciphertext), 'Invalid item ciphertext')
  assert(isCipher(item.wrappedItemKey), 'Invalid wrappedItemKey')
  assert(item.folderId == null || validVaultId(item.folderId), 'Invalid folderId')
  // Items in a shared folder also carry a copy of their content key wrapped to
  // the folder key, so recipients can open them.
  if (item.folderWrappedItemKey != null) {
    assert(isCipher(item.folderWrappedItemKey), 'Invalid folderWrappedItemKey')
  }
}

const itemRecord = (item, { withCreatedAt } = {}) => {
  const now = Date.now()
  const record = {
    folderId: item.folderId || null,
    wrappedItemKey: cipher(item.wrappedItemKey, 'wrappedItemKey'),
    ciphertext: cipher(item.ciphertext, 'item ciphertext'),
    folderWrappedItemKey: item.folderWrappedItemKey ? cipher(item.folderWrappedItemKey, 'folderWrappedItemKey') : null,
    updatedAt: now
  }
  if (withCreatedAt) { record.createdAt = now; record.rev = 1 }
  return record
}

const itemView = (id, r) => ({
  id,
  folderId: r.folderId || null,
  ciphertext: r.ciphertext,
  wrappedItemKey: r.wrappedItemKey || null,
  folderWrappedItemKey: r.folderWrappedItemKey || null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  rev: revision(r)
})

export const listItems = async (userId) => {
  const snap = await itemsRef(userId).get()
  return snap.docs.map((d) => itemView(d.id, d.data()))
}

export const createItem = async (userId, item, actor) => {
  validateItem(item)
  const id = randomUUID()
  const record = itemRecord(item, { withCreatedAt: true })
  await itemsRef(userId).doc(id).set(record)
  bumpShareRevs(userId, [record.folderId], userId).catch(() => {})
  logAudit(userId, { action: 'item.create', targetType: 'item', targetId: id, folderId: record.folderId, snapshot: itemSnapshot(record) }, actor).catch(() => {})
  return itemView(id, record)
}

export const updateItem = async (userId, id, item, actor) => {
  validateItem(item)
  const expectedRev = expectedRevision(item)
  const ref = itemsRef(userId).doc(id)
  const record = itemRecord(item)
  let prior
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref)
    if (!existing.exists) throw httpError(404, 'Entry not found')
    prior = existing.data()
    if (expectedRev !== null && expectedRev !== revision(prior)) throw conflict('Entry changed', itemView(id, prior))
    record.rev = revision(prior) + 1
    tx.set(ref, record, { merge: true })
  })
  // Old + new folder: an edit may also re-file the entry across a shared boundary.
  bumpShareRevs(userId, [prior.folderId, record.folderId], userId).catch(() => {})
  logAudit(userId, { action: 'item.update', targetType: 'item', targetId: id, folderId: record.folderId, snapshot: itemSnapshot(record) }, actor).catch(() => {})
  return itemView(id, { ...prior, ...record })
}

export const deleteItem = async (userId, id, actor) => {
  // Read the folder before deleting so participants of its shared subtree get notified.
  const ref = itemsRef(userId).doc(id)
  let data = null
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (!doc.exists) throw httpError(404, 'Entry not found')
    data = doc.data()
    tx.delete(ref)
  })
  const folderId = data ? data.folderId : null
  bumpShareRevs(userId, [folderId], userId).catch(() => {})
  // Snapshot the last state so a deleted entry stays identifiable in history.
  if (data) logAudit(userId, { action: 'item.delete', targetType: 'item', targetId: id, folderId, snapshot: itemSnapshot(data) }, actor).catch(() => {})
}

// Bulk delete (multi-select "Delete"). Entries already gone are skipped, so a
// retry after a partial failure is safe. Each deletion is audited like deleteItem.
export const deleteItems = async (userId, ids, actor) => {
  assert(Array.isArray(ids) && ids.length > 0, 'Expected a non-empty array of item ids')
  assert(ids.length <= 2000, 'Too many items in one delete')
  ids.forEach((id) => assert(validVaultId(id), 'Invalid item id'))
  assert(new Set(ids).size === ids.length, 'Duplicate item id')
  const removed = []
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400)
    await db.runTransaction(async (tx) => {
      const refs = chunk.map((id) => itemsRef(userId).doc(id))
      const docs = await Promise.all(refs.map((ref) => tx.get(ref)))
      docs.forEach((doc, n) => {
        if (!doc.exists) return
        removed.push({ id: chunk[n], data: doc.data() })
        tx.delete(refs[n])
      })
    })
  }
  if (removed.length) {
    bumpShareRevs(userId, removed.map((r) => r.data.folderId || null), userId).catch(() => {})
    logAudit(userId, removed.map((r) => ({
      action: 'item.delete', targetType: 'item', targetId: r.id, folderId: r.data.folderId || null, snapshot: itemSnapshot(r.data)
    })), actor).catch(() => {})
  }
  return { deleted: removed.length }
}

// Bulk-moves items to a folder (or to no folder when folderId is null). Only the
// plaintext folderId is changed — the encrypted content is never touched.
// `folderKeys` (optional) maps itemId -> folderWrappedItemKey. It is supplied
// when moving entries INTO a shared folder so recipients can still read them.
export const moveItems = async (userId, ids, folderId, folderKeys = null, actor) => {
  assert(Array.isArray(ids) && ids.length > 0, 'Expected a non-empty array of item ids')
  assert(ids.length <= 2000, 'Too many items in one move')
  ids.forEach((id) => assert(validVaultId(id), 'Invalid item id'))
  assert(folderId == null || validVaultId(folderId), 'Invalid folderId')
  if (folderKeys != null) {
    assert(typeof folderKeys === 'object', 'Invalid folderKeys')
    Object.values(folderKeys).forEach((c) => assert(isCipher(c), 'Invalid folderWrappedItemKey'))
  }
  assert(new Set(ids).size === ids.length, 'Duplicate item id')
  const sourceById = new Map()
  const revs = {}
  const now = Date.now()
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400)
    await db.runTransaction(async (tx) => {
      const refs = chunk.map((id) => itemsRef(userId).doc(id))
      const docs = await Promise.all(refs.map((ref) => tx.get(ref)))
      if (docs.some((doc) => !doc.exists)) throw httpError(404, 'Entry not found')
      docs.forEach((doc, n) => {
        const id = chunk[n]
        sourceById.set(id, doc.data().folderId || null)
        const update = { folderId: folderId || null, updatedAt: now, rev: revision(doc.data()) + 1 }
        if (folderKeys && folderKeys[id]) update.folderWrappedItemKey = cipher(folderKeys[id], 'folderWrappedItemKey')
        else if (folderKeys) update.folderWrappedItemKey = null
        revs[id] = update.rev
        tx.set(refs[n], update, { merge: true })
      })
    })
  }
  const sourceFolderIds = ids.map((id) => sourceById.get(id))
  bumpShareRevs(userId, [folderId, ...sourceFolderIds], userId).catch(() => {})
  // One move record per item so per-entry history stays complete.
  logAudit(userId, ids.map((id, idx) => ({
    action: 'item.move',
    targetType: 'item',
    targetId: id,
    folderId: folderId || null,
    meta: { fromFolderId: sourceFolderIds[idx] != null ? sourceFolderIds[idx] : null, toFolderId: folderId || null }
  })), actor).catch(() => {})
  return { success: true, revs }
}

// Bulk create for KeePass import. Firestore batches cap at 500 writes.
export const bulkCreateItems = async (userId, items, actor) => {
  assert(Array.isArray(items) && items.length > 0, 'Expected a non-empty array of items')
  assert(items.length <= 2000, 'Too many items in one import (max 2000)')
  items.forEach(validateItem)

  const created = []
  for (let i = 0; i < items.length; i += 400) {
    const chunk = items.slice(i, i + 400)
    const batch = db.batch()
    for (const item of chunk) {
      const id = randomUUID()
      const record = itemRecord(item, { withCreatedAt: true })
      batch.set(itemsRef(userId).doc(id), record)
      created.push(itemView(id, record))
    }
    await batch.commit()
  }
  bumpShareRevs(userId, created.map((c) => c.folderId), userId).catch(() => {})
  logAudit(userId, created.map((c) => ({
    action: 'item.create', targetType: 'item', targetId: c.id, folderId: c.folderId, snapshot: itemSnapshot(c)
  })), actor).catch(() => {})
  return created
}

// ---- Folders ----

const validateFolder = (folder = {}) => {
  assert(isCipher(folder.ciphertext), 'Invalid folder ciphertext')
  assert(folder.parentId == null || validVaultId(folder.parentId), 'Invalid parentId')
}

const folderView = (id, r) => ({
  id,
  parentId: r.parentId || null,
  position: typeof r.position === 'number' ? r.position : null,
  ciphertext: r.ciphertext || null,
  sharedName: r.sharedName || null,
  shared: r.shared === true,
  wrappedFolderKey: r.wrappedFolderKey || null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  rev: revision(r)
})

export const listFolders = async (userId) => {
  const snap = await foldersRef(userId).get()
  return snap.docs.map((d) => folderView(d.id, d.data()))
}

export const createFolder = async (userId, folder, actor) => {
  validateFolder(folder)
  const id = randomUUID()
  const now = Date.now()
  const record = {
    parentId: folder.parentId || null,
    ciphertext: cipher(folder.ciphertext, 'folder ciphertext'),
    position: typeof folder.position === 'number' ? folder.position : null,
    createdAt: now,
    updatedAt: now,
    rev: 1
  }
  // Folders inside a shared subtree also carry a folder-key-encrypted name so
  // recipients can read them.
  if (folder.sharedName != null) {
    assert(isCipher(folder.sharedName), 'Invalid sharedName')
    record.sharedName = cipher(folder.sharedName, 'sharedName')
  }
  await foldersRef(userId).doc(id).set(record)
  // New subfolder under a shared folder → recipients should see it appear.
  bumpShareRevs(userId, [id, record.parentId], userId).catch(() => {})
  logAudit(userId, { action: 'folder.create', targetType: 'folder', targetId: id, folderId: id, snapshot: folderSnapshot(record) }, actor).catch(() => {})
  return folderView(id, record)
}

// Batch-updates the parent and ordering of folders (used for drag-and-drop
// reorder / re-parent). Only parentId + position are touched, so the encrypted
// name is never rewritten.
export const reorderFolders = async (userId, updates, actor) => {
  assert(Array.isArray(updates) && updates.length > 0, 'Expected a non-empty array of folder updates')
  assert(updates.length <= 1000, 'Too many folder updates')
  updates.forEach((u) => {
    assert(u && validVaultId(u.id), 'Invalid folder id')
    assert(u.parentId == null || validVaultId(u.parentId), 'Invalid parentId')
    assert(typeof u.position === 'number', 'Invalid position')
  })
  assert(new Set(updates.map((u) => u.id)).size === updates.length, 'Duplicate folder id')
  const now = Date.now()
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400)
    await db.runTransaction(async (tx) => {
      const refs = chunk.map((u) => foldersRef(userId).doc(u.id))
      const docs = await Promise.all(refs.map((ref) => tx.get(ref)))
      if (docs.some((doc) => !doc.exists)) throw httpError(404, 'Folder not found')
      chunk.forEach((u, n) => tx.set(refs[n], {
        parentId: u.parentId || null,
        position: u.position,
        updatedAt: now,
        rev: revision(docs[n].data()) + 1
      }, { merge: true }))
    })
  }
  const touched = updates.flatMap((u) => [u.id, u.parentId])
  bumpShareRevs(userId, touched, userId).catch(() => {})
  logAudit(userId, updates.map((u) => ({
    action: 'folder.move',
    targetType: 'folder',
    targetId: u.id,
    folderId: u.id,
    meta: { toParentId: u.parentId || null, position: u.position }
  })), actor).catch(() => {})
  return { success: true }
}

export const updateFolder = async (userId, id, folder, actor) => {
  validateFolder(folder)
  const expectedRev = expectedRevision(folder)
  const ref = foldersRef(userId).doc(id)
  const record = { parentId: folder.parentId || null, ciphertext: cipher(folder.ciphertext, 'folder ciphertext'), updatedAt: Date.now() }
  if (folder.sharedName != null) {
    assert(isCipher(folder.sharedName), 'Invalid sharedName')
    record.sharedName = cipher(folder.sharedName, 'sharedName')
  }
  let prior
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref)
    if (!existing.exists) throw httpError(404, 'Folder not found')
    prior = existing.data()
    if (expectedRev !== null && expectedRev !== revision(prior)) throw conflict('Folder changed', folderView(id, prior))
    record.rev = revision(prior) + 1
    tx.set(ref, record, { merge: true })
  })
  // Rename or re-parent: notify shares on the folder itself and on its old + new parent.
  bumpShareRevs(userId, [id, prior.parentId, record.parentId], userId).catch(() => {})
  logAudit(userId, { action: 'folder.update', targetType: 'folder', targetId: id, folderId: id, snapshot: folderSnapshot(record) }, actor).catch(() => {})
  return folderView(id, { ...prior, ...record })
}

// Deleting a folder removes it and all of its descendant folders. Items in any
// of those folders are detached (moved to "no folder") rather than deleted, so
// no passwords are lost. Writes are chunked to respect Firestore's 500-op batch
// limit.
export const deleteFolder = async (userId, id, actor) => {
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

  // Notify BEFORE deleting, while the folder tree still contains the subtree —
  // afterward bumpShareRevs couldn't resolve shares rooted inside it. Awaited
  // (unlike the other, fire-and-forget bumps) for exactly that ordering.
  await bumpShareRevs(userId, [...subtree], userId).catch(() => {})

  const itemsSnap = await itemsRef(userId).get()
  const detached = []
  const auditEntries = []
  itemsSnap.docs.forEach((d) => {
    if (subtree.has(d.data().folderId)) {
      detached.push(d.ref)
      // Entries aren't deleted — they're detached to "no folder". Record that move.
      auditEntries.push({
        action: 'item.move',
        targetType: 'item',
        targetId: d.id,
        folderId: null,
        meta: { fromFolderId: d.data().folderId, toFolderId: null }
      })
    }
  })
  foldersSnap.docs.forEach((d) => {
    if (subtree.has(d.id)) {
      auditEntries.push({ action: 'folder.delete', targetType: 'folder', targetId: d.id, folderId: d.id, snapshot: folderSnapshot(d.data()) })
    }
  })
  for (let i = 0; i < detached.length; i += 400) {
    const refs = detached.slice(i, i + 400)
    await db.runTransaction(async (tx) => {
      const docs = await Promise.all(refs.map((ref) => tx.get(ref)))
      docs.forEach((doc, index) => {
        if (doc.exists && subtree.has(doc.data().folderId)) {
          tx.set(refs[index], { folderId: null, updatedAt: Date.now(), rev: revision(doc.data()) + 1 }, { merge: true })
        }
      })
    })
  }
  const folderIds = [...subtree]
  for (let i = 0; i < folderIds.length; i += 400) {
    const batch = db.batch()
    folderIds.slice(i, i + 400).forEach((fid) => batch.delete(foldersRef(userId).doc(fid)))
    await batch.commit()
  }
  logAudit(userId, auditEntries, actor).catch(() => {})
}

// ---- Sharing (Phase 2) ----
//
// Folder-level sharing. The owner generates a folder key client-side and wraps
// it to themselves (vault key -> folder.wrappedFolderKey) and to each recipient
// (their RSA public key -> share.wrappedFolderKey). Item content keys in the
// folder get a folderWrappedItemKey, so anyone holding the folder key can open
// every item in it. The server stores only ciphertext and never sees the folder
// key, so it still cannot read shared passwords.
const SHARES = 'vault_shares'
const sharesRef = () => db.collection(SHARES)

const commitOps = async (ops) => {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch()
    ops.slice(i, i + 400).forEach((op) => op(batch))
    await batch.commit()
  }
}

const commitVersionedUpdates = async (updates) => {
  const merged = new Map()
  updates.forEach(({ ref, fields }) => {
    const prior = merged.get(ref.path)
    merged.set(ref.path, { ref, fields: { ...(prior?.fields || {}), ...fields } })
  })
  const values = [...merged.values()]
  for (let i = 0; i < values.length; i += 400) {
    const chunk = values.slice(i, i + 400)
    await db.runTransaction(async (tx) => {
      const docs = await Promise.all(chunk.map(({ ref }) => tx.get(ref)))
      if (docs.some((doc) => !doc.exists)) throw httpError(404, 'Entry or folder not found')
      chunk.forEach(({ ref, fields }, index) => {
        tx.set(ref, { ...fields, updatedAt: Date.now(), rev: revision(docs[index].data()) + 1 }, { merge: true })
      })
    })
  }
}

// Real-time sync signal. When anything inside a shared subtree changes, bump the
// `contentRev` counter on every share whose subtree contains one of the changed
// folders, and stamp `lastWriterId` with the user who made the change. Participants'
// clients poll these (GET /vault/revisions) and re-fetch when a counter moves for a
// change they didn't make — the counter/id are non-secret, so this leaks no
// plaintext. Best-effort: callers do NOT await it and it must never throw into a
// mutation (wrap the call in `.catch(() => {})`). NOTE: for a folder DELETE, call
// this BEFORE deleting (and pass the whole deleted subtree) so the folder tree it
// walks still contains those folders. `actorId` is whoever made the change (the
// owner for owner ops, the recipient for shared-side ops).
export const bumpShareRevs = async (ownerId, folderIds, actorId) => {
  const changed = new Set((Array.isArray(folderIds) ? folderIds : [folderIds]).filter(Boolean))
  if (changed.size === 0) return
  const sharesSnap = await sharesRef().where('ownerId', '==', ownerId).get()
  if (sharesSnap.empty) return

  // Build the owner's folder tree once, then test each share's subtree for an
  // intersection with the changed folders without re-reading folders per share.
  const foldersSnap = await foldersRef(ownerId).get()
  const childrenByParent = new Map()
  foldersSnap.docs.forEach((d) => {
    const pid = d.data().parentId || null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(d.id)
  })
  const subtreeHitsChanged = (rootId) => {
    const stack = [rootId]
    const seen = new Set()
    while (stack.length) {
      const cur = stack.pop()
      if (seen.has(cur)) continue
      seen.add(cur)
      if (changed.has(cur)) return true
      for (const c of (childrenByParent.get(cur) || [])) stack.push(c)
    }
    return false
  }

  const batch = db.batch()
  let n = 0
  sharesSnap.docs.forEach((d) => {
    if (subtreeHitsChanged(d.data().folderId)) {
      batch.update(d.ref, { contentRev: FieldValue.increment(1), lastWriterId: actorId || null })
      n++
    }
  })
  if (n) await batch.commit()
}

// The current change-counter for every share I participate in (as recipient or
// owner), plus whether the latest change was MINE (so my own edits don't notify
// me). Cheap: a handful of share docs. Contains no plaintext.
export const getShareRevisions = async (userId) => {
  const [recvSnap, ownSnap] = await Promise.all([
    sharesRef().where('recipientUserId', '==', userId).get(),
    sharesRef().where('ownerId', '==', userId).get()
  ])
  const project = (d) => ({ rev: d.data().contentRev || 0, mine: d.data().lastWriterId === userId })
  const received = {}
  const owned = {}
  recvSnap.docs.forEach((d) => { received[d.id] = project(d) })
  ownSnap.docs.forEach((d) => { owned[d.id] = project(d) })
  return { received, owned }
}

// Sharing is recursive, so EVERY folder in the subtree needs a folder-key
// encrypted name (so recipients can read it) and every entry in the subtree
// needs its content key wrapped to the folder key.
const subtreeSetupOps = (ownerId, setup) => {
  const folderNames = Array.isArray(setup.folderNames) ? setup.folderNames : []
  const itemKeys = Array.isArray(setup.itemKeys) ? setup.itemKeys : []
  assert(folderNames.length <= 2000, 'Too many folders to share at once')
  assert(itemKeys.length <= 2000, 'Too many entries to share at once')
  const ops = []
  folderNames.forEach((fn) => {
    assert(fn && validVaultId(fn.id) && isCipher(fn.sharedName), 'Invalid folder name entry')
    ops.push({ ref: foldersRef(ownerId).doc(fn.id), fields: { sharedName: cipher(fn.sharedName, 'sharedName') } })
  })
  itemKeys.forEach((ik) => {
    assert(ik && validVaultId(ik.id) && isCipher(ik.folderWrappedItemKey), 'Invalid item key entry')
    ops.push({ ref: itemsRef(ownerId).doc(ik.id), fields: { folderWrappedItemKey: cipher(ik.folderWrappedItemKey, 'folderWrappedItemKey') } })
  })
  return ops
}

// Backfills folder-key names/keys across an already-shared subtree. Used to heal
// shares made before recursive sharing, and after the owner adds things.
export const updateShareSetup = async (ownerId, folderId, body = {}) => {
  const folderDoc = await foldersRef(ownerId).doc(folderId).get()
  if (!folderDoc.exists) throw httpError(404, 'Folder not found')
  const ops = subtreeSetupOps(ownerId, body)
  if (ops.length) await commitVersionedUpdates(ops)
  bumpShareRevs(ownerId, [folderId], ownerId).catch(() => {})
  return { updated: ops.length }
}

const shareView = (s) => ({
  id: s.id,
  folderId: s.folderId,
  recipientEmail: s.recipientEmail,
  permission: s.permission,
  createdAt: s.createdAt
})

export const createShare = async (ownerId, body = {}) => {
  const { folderId, recipientEmail, permission, wrappedFolderKey, folderSetup } = body
  assert(validVaultId(folderId), 'Invalid folderId')
  assert(permission === 'edit' || permission === 'view', "permission must be 'edit' or 'view'")
  assert(typeof wrappedFolderKey === 'string' && wrappedFolderKey.length > 0 && wrappedFolderKey.length <= 8192, 'Invalid wrappedFolderKey')

  const folderDoc = await foldersRef(ownerId).doc(folderId).get()
  if (!folderDoc.exists) throw httpError(404, 'Folder not found')

  // Recipient must already have a vault with a sharing keypair.
  const recipient = await getPublicKeyByEmail(recipientEmail)
  if (recipient.userId === ownerId) throw httpError(400, 'You cannot share a folder with yourself')

  const dup = await sharesRef()
    .where('ownerId', '==', ownerId)
    .where('folderId', '==', folderId)
    .where('recipientUserId', '==', recipient.userId)
    .limit(1).get()
  if (!dup.empty) throw httpError(409, 'This folder is already shared with that user')

  const now = Date.now()

  // First time this folder is shared: persist the owner's wrapped folder key,
  // the folder-key-encrypted name (so recipients can read it) and the re-wrapped
  // item keys for everything already in the folder.
  if (folderSetup) {
    assert(isCipher(folderSetup.wrappedFolderKey), 'Invalid folderSetup.wrappedFolderKey')
    assert(isCipher(folderSetup.sharedName), 'Invalid folderSetup.sharedName')
    const ops = [{
      ref: foldersRef(ownerId).doc(folderId),
      fields: {
        shared: true,
        wrappedFolderKey: cipher(folderSetup.wrappedFolderKey, 'wrappedFolderKey'),
        sharedName: cipher(folderSetup.sharedName, 'sharedName')
      }
    }]
    ops.push(...subtreeSetupOps(ownerId, folderSetup))
    await commitVersionedUpdates(ops)
  }

  const id = randomUUID()
  const record = {
    id,
    ownerId,
    folderId,
    recipientUserId: recipient.userId,
    recipientEmail: recipient.email,
    permission,
    wrappedFolderKey,
    contentRev: 0,
    createdAt: now
  }
  await sharesRef().doc(id).set(record)
  return shareView(record)
}

// Recipients of one specific folder I own.
export const listSharesForFolder = async (ownerId, folderId) => {
  assert(typeof folderId === 'string' && folderId.length > 0, 'Invalid folderId')
  const snap = await sharesRef().where('ownerId', '==', ownerId).where('folderId', '==', folderId).get()
  return snap.docs.map((d) => shareView(d.data()))
}

// Every share I have granted (lets the UI badge which folders are shared).
export const listMyShares = async (ownerId) => {
  const snap = await sharesRef().where('ownerId', '==', ownerId).get()
  return snap.docs.map((d) => shareView(d.data()))
}

// Simple revoke: drop the share record so the recipient can no longer fetch the
// folder. (Per the agreed design we do NOT rotate the folder key, so anything
// they already decrypted they still have — change the password to be sure.)
export const deleteShare = async (ownerId, shareId) => {
  const doc = await sharesRef().doc(shareId).get()
  if (!doc.exists) throw httpError(404, 'Share not found')
  if (doc.data().ownerId !== ownerId) throw httpError(403, 'Not authorized to revoke this share')
  await sharesRef().doc(shareId).delete()
  return { success: true }
}

// ---- Cross-user access to shared folders ----
//
// This is the one place where a user touches data under ANOTHER user's vault, so
// every call is gated on a matching share record (and on 'edit' for writes).

// All folder ids in the subtree rooted at rootId (inclusive). Sharing is
// recursive: sharing a parent shares every descendant folder and its entries.
const folderSubtreeIds = async (ownerId, rootId) => {
  const snap = await foldersRef(ownerId).get()
  const childrenByParent = new Map()
  snap.docs.forEach((d) => {
    const pid = d.data().parentId || null
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(d.id)
  })
  const ids = new Set()
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()
    if (ids.has(cur)) continue
    ids.add(cur)
    for (const c of (childrenByParent.get(cur) || [])) stack.push(c)
  }
  return ids
}

// Grants access if `folderId` sits anywhere inside a subtree the user has been
// shared (so a share on a parent covers all of its descendants).
const requireShareForFolder = async (userId, ownerId, folderId, needEdit) => {
  if (!folderId) throw httpError(403, 'That entry is not in a shared folder')
  const snap = await sharesRef()
    .where('ownerId', '==', ownerId)
    .where('recipientUserId', '==', userId)
    .get()
  if (snap.empty) throw httpError(403, 'You do not have access to this folder')
  let sawSubtreeButViewOnly = false
  for (const d of snap.docs) {
    const share = d.data()
    const subtree = await folderSubtreeIds(ownerId, share.folderId)
    if (!subtree.has(folderId)) continue
    if (needEdit && share.permission !== 'edit') { sawSubtreeButViewOnly = true; continue }
    return share
  }
  if (sawSubtreeButViewOnly) throw httpError(403, 'You have view-only access to this folder')
  throw httpError(403, 'You do not have access to this folder')
}

// Folders shared WITH me, including the folder key wrapped to my public key and
// the folder-key-encrypted name so I can display it.
export const listSharedWithMe = async (userId) => {
  const snap = await sharesRef().where('recipientUserId', '==', userId).get()
  const out = []
  for (const d of snap.docs) {
    const s = d.data()
    const folderDoc = await foldersRef(s.ownerId).doc(s.folderId).get()
    if (!folderDoc.exists) continue // owner deleted the folder
    const ownerDoc = await db.collection('users').doc(s.ownerId).get()
    out.push({
      shareId: s.id,
      ownerId: s.ownerId,
      ownerEmail: ownerDoc.exists ? (ownerDoc.data().email || null) : null,
      folderId: s.folderId,
      permission: s.permission,
      wrappedFolderKey: s.wrappedFolderKey,
      sharedName: folderDoc.data().sharedName || null,
      createdAt: s.createdAt
    })
  }
  return out
}

// The whole shared subtree: every descendant folder (so the recipient can render
// the tree) plus every entry anywhere inside it.
export const listSharedTree = async (userId, ownerId, rootId) => {
  const share = await requireShareForFolder(userId, ownerId, rootId, false)
  const subtree = await folderSubtreeIds(ownerId, rootId)
  const [fSnap, iSnap] = await Promise.all([foldersRef(ownerId).get(), itemsRef(ownerId).get()])
  const folders = fSnap.docs
    .filter((d) => subtree.has(d.id))
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        parentId: x.parentId || null,
        position: typeof x.position === 'number' ? x.position : null,
        sharedName: x.sharedName || null,
        rev: revision(x)
      }
    })
  const items = iSnap.docs
    .filter((d) => subtree.has(d.data().folderId))
    .map((d) => itemView(d.id, d.data()))
  return { rootId, permission: share.permission, folders, items }
}

// Edit an entry anywhere inside a shared subtree (requires 'edit').
export const updateSharedItem = async (userId, ownerId, itemId, body = {}, actor) => {
  const ref = itemsRef(ownerId).doc(itemId)
  const doc = await ref.get()
  if (!doc.exists) throw httpError(404, 'Entry not found')
  await requireShareForFolder(userId, ownerId, doc.data().folderId, true)
  const expectedRev = expectedRevision(body)
  const record = { ciphertext: cipher(body.ciphertext, 'item ciphertext'), updatedAt: Date.now() }
  if (body.folderWrappedItemKey) {
    record.folderWrappedItemKey = cipher(body.folderWrappedItemKey, 'folderWrappedItemKey')
    // The recipient re-encrypted with a NEW content key, so the owner's
    // vault-key copy no longer matches the ciphertext — drop it rather than
    // leave a stale key the owner would try (and fail) to decrypt with.
    record.wrappedItemKey = null
  }
  let prior
  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref)
    if (!current.exists) throw httpError(404, 'Entry not found')
    prior = current.data()
    if (prior.folderId !== doc.data().folderId) throw conflict('Entry changed', itemView(itemId, prior))
    if (expectedRev !== null && expectedRev !== revision(prior)) throw conflict('Entry changed', itemView(itemId, prior))
    record.rev = revision(prior) + 1
    tx.set(ref, record, { merge: true })
  })
  bumpShareRevs(ownerId, [prior.folderId], userId).catch(() => {})
  // Recorded under the OWNER's vault, attributed to the recipient (actor).
  logAudit(ownerId, { action: 'item.update', targetType: 'item', targetId: itemId, folderId: prior.folderId, snapshot: itemSnapshot({ ...prior, ...record }) }, actor).catch(() => {})
  return itemView(itemId, { ...prior, ...record })
}

// Add an entry anywhere inside a shared subtree (requires 'edit'). Stored under
// the OWNER's vault, keyed to the folder key so the owner can read it too.
export const createSharedItem = async (userId, ownerId, folderId, item = {}, actor) => {
  await requireShareForFolder(userId, ownerId, folderId, true)
  const ciphertext = cipher(item.ciphertext, 'item ciphertext')
  const folderWrappedItemKey = cipher(item.folderWrappedItemKey, 'folderWrappedItemKey')
  const id = randomUUID()
  const now = Date.now()
  const record = {
    folderId,
    ciphertext,
    folderWrappedItemKey,
    createdAt: now,
    updatedAt: now,
    rev: 1
  }
  await itemsRef(ownerId).doc(id).set(record)
  bumpShareRevs(ownerId, [folderId], userId).catch(() => {})
  logAudit(ownerId, { action: 'item.create', targetType: 'item', targetId: id, folderId, snapshot: itemSnapshot(record) }, actor).catch(() => {})
  return itemView(id, record)
}

// Bulk-add entries to a shared subtree (KeePass import by a recipient).
export const bulkCreateSharedItems = async (userId, ownerId, items, actor) => {
  assert(Array.isArray(items) && items.length > 0, 'Expected a non-empty array of items')
  assert(items.length <= 2000, 'Too many items in one import (max 2000)')
  // Every target folder must be inside a subtree I can edit.
  const folderIds = [...new Set(items.map((i) => i && i.folderId))]
  for (const fid of folderIds) await requireShareForFolder(userId, ownerId, fid, true)
  items.forEach((i) => {
    assert(isCipher(i.ciphertext), 'Invalid item ciphertext')
    assert(isCipher(i.folderWrappedItemKey), 'Invalid folderWrappedItemKey')
  })
  const now = Date.now()
  const created = []
  const ops = []
  for (const i of items) {
    const id = randomUUID()
    const record = {
      folderId: i.folderId,
      ciphertext: cipher(i.ciphertext, 'item ciphertext'),
      folderWrappedItemKey: cipher(i.folderWrappedItemKey, 'folderWrappedItemKey'),
      createdAt: now,
      updatedAt: now,
      rev: 1
    }
    ops.push((b) => b.set(itemsRef(ownerId).doc(id), record))
    created.push(itemView(id, record))
  }
  await commitOps(ops)
  bumpShareRevs(ownerId, folderIds, userId).catch(() => {})
  logAudit(ownerId, created.map((c) => ({
    action: 'item.create', targetType: 'item', targetId: c.id, folderId: c.folderId, snapshot: itemSnapshot(c)
  })), actor).catch(() => {})
  return created
}

// NOTE: recipients deliberately cannot create folders in a shared subtree — only
// the owner manages the folder structure. Recipients may add/edit entries (with
// 'edit') and move them between existing folders.

// Move entries within a shared subtree (requires 'edit'). Callers pass the
// re-wrapped folder key copy for each item so it stays readable.
export const moveSharedItems = async (userId, ownerId, updates, actor) => {
  assert(Array.isArray(updates) && updates.length > 0, 'Expected a non-empty array of moves')
  assert(updates.length <= 2000, 'Too many items in one move')
  const folderIds = [...new Set(updates.map((u) => u && u.folderId))]
  for (const fid of folderIds) await requireShareForFolder(userId, ownerId, fid, true)

  const now = Date.now()
  const revs = {}
  const touched = [...folderIds] // destinations
  const auditEntries = []
  const authorizedSources = new Map()
  for (const u of updates) {
    assert(u && validVaultId(u.id) && validVaultId(u.folderId), 'Invalid item id')
    // The same folder key covers the whole subtree, so a move within it doesn't
    // need a new wrapped key — only supply one when it actually changes.
    if (u.folderWrappedItemKey != null) {
      assert(isCipher(u.folderWrappedItemKey), 'Invalid folderWrappedItemKey')
    }
    // The item must already be somewhere I can edit.
    const doc = await itemsRef(ownerId).doc(u.id).get()
    if (!doc.exists) throw httpError(404, 'Entry not found')
    await requireShareForFolder(userId, ownerId, doc.data().folderId, true)
    authorizedSources.set(u.id, doc.data().folderId)
  }
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400)
    const committed = await db.runTransaction(async (tx) => {
      const refs = chunk.map((u) => itemsRef(ownerId).doc(u.id))
      const docs = await Promise.all(refs.map((ref) => tx.get(ref)))
      if (docs.some((doc) => !doc.exists)) throw httpError(404, 'Entry not found')
      const changes = chunk.map((u, n) => {
        const prior = docs[n].data()
        if (prior.folderId !== authorizedSources.get(u.id)) throw httpError(409, 'Entry changed')
        const update = { folderId: u.folderId, updatedAt: now, rev: revision(prior) + 1 }
        if (u.folderWrappedItemKey != null) update.folderWrappedItemKey = cipher(u.folderWrappedItemKey, 'folderWrappedItemKey')
        tx.set(refs[n], update, { merge: true })
        return { id: u.id, rev: update.rev, source: prior.folderId, destination: u.folderId }
      })
      return changes
    })
    committed.forEach(({ id, rev, source, destination }) => {
      revs[id] = rev
      touched.push(source)
      auditEntries.push({
        action: 'item.move',
        targetType: 'item',
        targetId: id,
        folderId: destination,
        meta: { fromFolderId: source, toFolderId: destination }
      })
    })
  }
  bumpShareRevs(ownerId, touched, userId).catch(() => {})
  logAudit(ownerId, auditEntries, actor).catch(() => {})
  return { success: true, revs }
}

// Version history for a single entry inside a folder shared WITH me. Owner-only
// history stays private; this is the recipient's scoped view of ONE entry they
// already have access to. Three guardrails keep it from leaking anything else:
//   1. Authorization reuses requireShareForFolder (view access is enough).
//   2. Records are filtered to the shared subtree, so history from when the entry
//      lived in one of the owner's PRIVATE folders is never returned.
//   3. Any actor who is neither the recipient nor the owner (i.e. a co-recipient)
//      is stripped of id + email, so a recipient can't discover who else the
//      folder is shared with.
export const listSharedItemAudit = async (userId, ownerId, itemId, opts = {}) => {
  const doc = await itemsRef(ownerId).doc(itemId).get()
  if (!doc.exists) throw httpError(404, 'Item not found')
  const share = await requireShareForFolder(userId, ownerId, doc.data().folderId, false)
  const subtree = await folderSubtreeIds(ownerId, share.folderId)
  const records = await listAudit(ownerId, { ...opts, targetId: itemId })
  return records
    .filter((r) => r.folderId != null && subtree.has(r.folderId))
    .map((r) => (r.actorId === userId || r.actorId === ownerId)
      ? r
      : { ...r, actorId: null, actorEmail: null })
}
