import express from 'express'
import * as vault from '../services/vaultService.js'

const router = express.Router()

// Wraps a handler so thrown errors map to their http status (default 500) and
// the user id always comes from the authenticated session, never the body.
// Expected client errors (4xx, e.g. a 404 when the vault isn't initialized yet)
// are normal control flow and are not logged; only 5xx server faults are.
const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (error) {
    const status = error.status || 500
    if (status >= 500) console.error(error)
    res.status(status).json({ error: error.message || 'Vault operation failed' })
  }
}

// ---- Vault metadata ----

router.get('/', handle(async (req) => {
  const v = await vault.getVault(req.user.id)
  if (!v) throw Object.assign(new Error('Vault not initialized'), { status: 404 })
  return v
}))

router.post('/', handle((req) => vault.initVault(req.user.id, req.body)))
router.put('/key', handle((req) => vault.rotateVaultKey(req.user.id, req.body)))

// Sharing keypair: set on an existing vault (migration), and look up a
// recipient's public key by email.
router.post('/keys', handle((req) => vault.setVaultKeys(req.user.id, req.body)))
router.get('/pubkey', handle((req) => vault.getPublicKeyByEmail(req.query && req.query.email)))

// ---- Items ----

router.get('/items', handle((req) => vault.listItems(req.user.id)))
router.post('/items', handle((req) => vault.createItem(req.user.id, req.body)))
router.post('/items/bulk', handle((req) => vault.bulkCreateItems(req.user.id, req.body && req.body.items)))
// Must be declared before '/items/:id' so it isn't captured as an id.
router.put('/items/move', handle((req) => vault.moveItems(
  req.user.id, req.body && req.body.ids, req.body && req.body.folderId, req.body && req.body.folderKeys)))
router.put('/items/:id', handle((req) => vault.updateItem(req.user.id, req.params.id, req.body)))
router.delete('/items/:id', handle(async (req) => {
  await vault.deleteItem(req.user.id, req.params.id)
  return { success: true }
}))

// ---- Folders ----

// ---- Sharing ----

router.post('/shares', handle((req) => vault.createShare(req.user.id, req.body)))
router.get('/shares', handle((req) => vault.listMyShares(req.user.id)))
router.get('/shares/folder/:folderId', handle((req) => vault.listSharesForFolder(req.user.id, req.params.folderId)))
router.delete('/shares/:id', handle((req) => vault.deleteShare(req.user.id, req.params.id)))

// Folders shared WITH me, and access to the entries inside them. Every one of
// these is authorized against a matching share record inside the service.
router.get('/shared', handle((req) => vault.listSharedWithMe(req.user.id)))
// The whole shared subtree (descendant folders + all their entries).
router.get('/shared/:ownerId/tree/:rootId',
  handle((req) => vault.listSharedTree(req.user.id, req.params.ownerId, req.params.rootId)))
// (No shared folder-creation route: recipients cannot create folders — the
// owner manages the folder structure. Recipients add/edit/move entries only.)
router.post('/shared/:ownerId/folders/:folderId/items',
  handle((req) => vault.createSharedItem(req.user.id, req.params.ownerId, req.params.folderId, req.body)))
// Declared before '/items/:id' so they aren't captured as an id.
router.post('/shared/:ownerId/items/bulk',
  handle((req) => vault.bulkCreateSharedItems(req.user.id, req.params.ownerId, req.body && req.body.items)))
router.put('/shared/:ownerId/items/move',
  handle((req) => vault.moveSharedItems(req.user.id, req.params.ownerId, req.body && req.body.updates)))
router.put('/shared/:ownerId/items/:id',
  handle((req) => vault.updateSharedItem(req.user.id, req.params.ownerId, req.params.id, req.body)))

// ---- Folders ----

router.get('/folders', handle((req) => vault.listFolders(req.user.id)))
router.post('/folders', handle((req) => vault.createFolder(req.user.id, req.body)))
// Must be declared before '/folders/:id' so it isn't captured as an id.
router.put('/folders/reorder', handle((req) => vault.reorderFolders(req.user.id, req.body && req.body.updates)))
// Backfill folder-key names/keys across a shared subtree (repair + upkeep).
router.put('/folders/:id/share-setup', handle((req) => vault.updateShareSetup(req.user.id, req.params.id, req.body)))
router.put('/folders/:id', handle((req) => vault.updateFolder(req.user.id, req.params.id, req.body)))
router.delete('/folders/:id', handle(async (req) => {
  await vault.deleteFolder(req.user.id, req.params.id)
  return { success: true }
}))

export default router
