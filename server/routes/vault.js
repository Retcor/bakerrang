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

// ---- Items ----

router.get('/items', handle((req) => vault.listItems(req.user.id)))
router.post('/items', handle((req) => vault.createItem(req.user.id, req.body)))
router.post('/items/bulk', handle((req) => vault.bulkCreateItems(req.user.id, req.body && req.body.items)))
// Must be declared before '/items/:id' so it isn't captured as an id.
router.put('/items/move', handle((req) => vault.moveItems(req.user.id, req.body && req.body.ids, req.body && req.body.folderId)))
router.put('/items/:id', handle((req) => vault.updateItem(req.user.id, req.params.id, req.body)))
router.delete('/items/:id', handle(async (req) => {
  await vault.deleteItem(req.user.id, req.params.id)
  return { success: true }
}))

// ---- Folders ----

router.get('/folders', handle((req) => vault.listFolders(req.user.id)))
router.post('/folders', handle((req) => vault.createFolder(req.user.id, req.body)))
// Must be declared before '/folders/:id' so it isn't captured as an id.
router.put('/folders/reorder', handle((req) => vault.reorderFolders(req.user.id, req.body && req.body.updates)))
router.put('/folders/:id', handle((req) => vault.updateFolder(req.user.id, req.params.id, req.body)))
router.delete('/folders/:id', handle(async (req) => {
  await vault.deleteFolder(req.user.id, req.params.id)
  return { success: true }
}))

export default router
