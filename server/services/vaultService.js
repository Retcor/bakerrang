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
    publicKey: data.publicKey || null,
    protectedPrivateKey: data.protectedPrivateKey || null,
    createdAt: data.createdAt
  }
}

export const initVault = async (userId, body = {}) => {
  const { kdf, protectedVaultKey, publicKey, protectedPrivateKey } = body
  assert(kdf && typeof kdf.algo === 'string' && typeof kdf.salt === 'string', 'Invalid kdf parameters')
  assert(isCipher(protectedVaultKey), 'Invalid protectedVaultKey')

  const ref = vaultRef(userId)
  const existing = await ref.get()
  if (existing.exists) throw httpError(409, 'Vault already exists')

  const now = Date.now()
  const record = { userId, kdf, protectedVaultKey, createdAt: now, updatedAt: now }
  // Sharing keypair (optional on older clients).
  if (typeof publicKey === 'string' && isCipher(protectedPrivateKey)) {
    record.publicKey = publicKey
    record.protectedPrivateKey = protectedPrivateKey
  }
  await ref.set(record)
  return { kdf, protectedVaultKey, publicKey: record.publicKey || null, createdAt: now }
}

// Adds/updates the sharing keypair on an existing vault (migration for vaults
// created before Phase 2). The private key is client-encrypted with the vault key.
export const setVaultKeys = async (userId, body = {}) => {
  const { publicKey, protectedPrivateKey } = body
  assert(typeof publicKey === 'string' && publicKey.length > 0 && publicKey.length <= 4096, 'Invalid publicKey')
  assert(isCipher(protectedPrivateKey), 'Invalid protectedPrivateKey')
  const ref = vaultRef(userId)
  const existing = await ref.get()
  if (!existing.exists) throw httpError(404, 'Vault not found')
  await ref.update({ publicKey, protectedPrivateKey, updatedAt: Date.now() })
  return { publicKey }
}

// Resolves a Gmail address to that user's sharing public key. Requires the
// recipient to already have a vault with a keypair.
export const getPublicKeyByEmail = async (email) => {
  assert(typeof email === 'string' && email.includes('@'), 'Invalid email')
  const normalized = email.trim().toLowerCase()
  const snap = await db.collection('users').where('emailLower', '==', normalized).limit(1).get()
  if (snap.empty) throw httpError(404, 'No user with that email')
  const recipientId = snap.docs[0].id
  const vaultDoc = await vaultRef(recipientId).get()
  if (!vaultDoc.exists || !vaultDoc.data().publicKey) {
    throw httpError(409, 'That user has not set up their password vault yet')
  }
  return { userId: recipientId, email: normalized, publicKey: vaultDoc.data().publicKey }
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
    wrappedItemKey: item.wrappedItemKey,
    ciphertext: item.ciphertext,
    folderWrappedItemKey: item.folderWrappedItemKey || null,
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
// `folderKeys` (optional) maps itemId -> folderWrappedItemKey. It is supplied
// when moving entries INTO a shared folder so recipients can still read them.
export const moveItems = async (userId, ids, folderId, folderKeys = null) => {
  assert(Array.isArray(ids) && ids.length > 0, 'Expected a non-empty array of item ids')
  assert(ids.length <= 2000, 'Too many items in one move')
  ids.forEach((id) => assert(typeof id === 'string', 'Invalid item id'))
  assert(folderId == null || typeof folderId === 'string', 'Invalid folderId')
  if (folderKeys != null) {
    assert(typeof folderKeys === 'object', 'Invalid folderKeys')
    Object.values(folderKeys).forEach((c) => assert(isCipher(c), 'Invalid folderWrappedItemKey'))
  }

  const now = Date.now()
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch()
    for (const id of ids.slice(i, i + 400)) {
      const update = { folderId: folderId || null, updatedAt: now }
      // Moving into a shared folder: attach the folder-key copy. Moving out of
      // one: drop it so it isn't readable through a stale key.
      if (folderKeys && folderKeys[id]) update.folderWrappedItemKey = folderKeys[id]
      else if (folderKeys) update.folderWrappedItemKey = null
      batch.update(itemsRef(userId).doc(id), update)
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
  // Folders inside a shared subtree also carry a folder-key-encrypted name so
  // recipients can read them.
  if (folder.sharedName != null) {
    assert(isCipher(folder.sharedName), 'Invalid sharedName')
    record.sharedName = folder.sharedName
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
  if (folder.sharedName != null) {
    assert(isCipher(folder.sharedName), 'Invalid sharedName')
    record.sharedName = folder.sharedName
  }
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

// Sharing is recursive, so EVERY folder in the subtree needs a folder-key
// encrypted name (so recipients can read it) and every entry in the subtree
// needs its content key wrapped to the folder key.
const subtreeSetupOps = (ownerId, setup, now) => {
  const folderNames = Array.isArray(setup.folderNames) ? setup.folderNames : []
  const itemKeys = Array.isArray(setup.itemKeys) ? setup.itemKeys : []
  assert(folderNames.length <= 2000, 'Too many folders to share at once')
  assert(itemKeys.length <= 2000, 'Too many entries to share at once')
  const ops = []
  folderNames.forEach((fn) => {
    assert(fn && typeof fn.id === 'string' && isCipher(fn.sharedName), 'Invalid folder name entry')
    ops.push((b) => b.update(foldersRef(ownerId).doc(fn.id), { sharedName: fn.sharedName, updatedAt: now }))
  })
  itemKeys.forEach((ik) => {
    assert(ik && typeof ik.id === 'string' && isCipher(ik.folderWrappedItemKey), 'Invalid item key entry')
    ops.push((b) => b.update(itemsRef(ownerId).doc(ik.id), { folderWrappedItemKey: ik.folderWrappedItemKey, updatedAt: now }))
  })
  return ops
}

// Backfills folder-key names/keys across an already-shared subtree. Used to heal
// shares made before recursive sharing, and after the owner adds things.
export const updateShareSetup = async (ownerId, folderId, body = {}) => {
  const folderDoc = await foldersRef(ownerId).doc(folderId).get()
  if (!folderDoc.exists) throw httpError(404, 'Folder not found')
  const ops = subtreeSetupOps(ownerId, body, Date.now())
  if (ops.length) await commitOps(ops)
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
  assert(typeof folderId === 'string' && folderId.length > 0, 'Invalid folderId')
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
    const ops = [(b) => b.update(foldersRef(ownerId).doc(folderId), {
      shared: true,
      wrappedFolderKey: folderSetup.wrappedFolderKey,
      sharedName: folderSetup.sharedName,
      updatedAt: now
    })]
    ops.push(...subtreeSetupOps(ownerId, folderSetup, now))
    await commitOps(ops)
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
        sharedName: x.sharedName || null
      }
    })
  const items = iSnap.docs
    .filter((d) => subtree.has(d.data().folderId))
    .map((d) => ({ id: d.id, ...d.data() }))
  return { rootId, permission: share.permission, folders, items }
}

// Edit an entry anywhere inside a shared subtree (requires 'edit').
export const updateSharedItem = async (userId, ownerId, itemId, body = {}) => {
  const ref = itemsRef(ownerId).doc(itemId)
  const doc = await ref.get()
  if (!doc.exists) throw httpError(404, 'Item not found')
  await requireShareForFolder(userId, ownerId, doc.data().folderId, true)

  assert(isCipher(body.ciphertext), 'Invalid item ciphertext')
  const record = { ciphertext: body.ciphertext, updatedAt: Date.now() }
  if (body.folderWrappedItemKey) {
    assert(isCipher(body.folderWrappedItemKey), 'Invalid folderWrappedItemKey')
    record.folderWrappedItemKey = body.folderWrappedItemKey
    // The recipient re-encrypted with a NEW content key, so the owner's
    // vault-key copy no longer matches the ciphertext — drop it rather than
    // leave a stale key the owner would try (and fail) to decrypt with.
    record.wrappedItemKey = null
  }
  await ref.update(record)
  return { id: itemId, ...record }
}

// Add an entry anywhere inside a shared subtree (requires 'edit'). Stored under
// the OWNER's vault, keyed to the folder key so the owner can read it too.
export const createSharedItem = async (userId, ownerId, folderId, item = {}) => {
  await requireShareForFolder(userId, ownerId, folderId, true)
  assert(isCipher(item.ciphertext), 'Invalid item ciphertext')
  assert(isCipher(item.folderWrappedItemKey), 'Invalid folderWrappedItemKey')
  const id = randomUUID()
  const now = Date.now()
  const record = {
    folderId,
    ciphertext: item.ciphertext,
    folderWrappedItemKey: item.folderWrappedItemKey,
    createdAt: now,
    updatedAt: now
  }
  await itemsRef(ownerId).doc(id).set(record)
  return { id, ...record }
}

// Bulk-add entries to a shared subtree (KeePass import by a recipient).
export const bulkCreateSharedItems = async (userId, ownerId, items) => {
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
      ciphertext: i.ciphertext,
      folderWrappedItemKey: i.folderWrappedItemKey,
      createdAt: now,
      updatedAt: now
    }
    ops.push((b) => b.set(itemsRef(ownerId).doc(id), record))
    created.push({ id, ...record })
  }
  await commitOps(ops)
  return created
}

// Create a subfolder inside a shared subtree (requires 'edit'). The name is
// encrypted with the folder key, so both the owner and other recipients read it.
export const createSharedFolder = async (userId, ownerId, parentId, folder = {}) => {
  await requireShareForFolder(userId, ownerId, parentId, true)
  assert(isCipher(folder.sharedName), 'Invalid sharedName')
  const id = randomUUID()
  const now = Date.now()
  const record = {
    parentId,
    sharedName: folder.sharedName,
    position: typeof folder.position === 'number' ? folder.position : null,
    createdAt: now,
    updatedAt: now
  }
  await foldersRef(ownerId).doc(id).set(record)
  return { id, ...record }
}

// Move entries within a shared subtree (requires 'edit'). Callers pass the
// re-wrapped folder key copy for each item so it stays readable.
export const moveSharedItems = async (userId, ownerId, updates) => {
  assert(Array.isArray(updates) && updates.length > 0, 'Expected a non-empty array of moves')
  assert(updates.length <= 2000, 'Too many items in one move')
  const folderIds = [...new Set(updates.map((u) => u && u.folderId))]
  for (const fid of folderIds) await requireShareForFolder(userId, ownerId, fid, true)

  const now = Date.now()
  const ops = []
  for (const u of updates) {
    assert(u && typeof u.id === 'string', 'Invalid item id')
    // The same folder key covers the whole subtree, so a move within it doesn't
    // need a new wrapped key — only supply one when it actually changes.
    if (u.folderWrappedItemKey != null) {
      assert(isCipher(u.folderWrappedItemKey), 'Invalid folderWrappedItemKey')
    }
    // The item must already be somewhere I can edit.
    const doc = await itemsRef(ownerId).doc(u.id).get()
    if (!doc.exists) throw httpError(404, 'Item not found')
    await requireShareForFolder(userId, ownerId, doc.data().folderId, true)
    const update = { folderId: u.folderId, updatedAt: now }
    if (u.folderWrappedItemKey != null) update.folderWrappedItemKey = u.folderWrappedItemKey
    ops.push((b) => b.update(itemsRef(ownerId).doc(u.id), update))
  }
  await commitOps(ops)
  return { success: true }
}
