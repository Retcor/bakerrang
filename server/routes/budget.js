import express from 'express'
import { noStore } from '../middleware/contentSecurity.js'
import {
  createBill,
  createPayday,
  deleteBill,
  deleteItem,
  deleteNewPayday,
  deletePayday,
  getBudget,
  getPlan,
  saveItem,
  savePayday,
  updateBill,
  updatePayday
} from '../services/budgetService.js'

const router = express.Router()
router.use(noStore)

const safeLog = (op, error) => console.error(`[budget] ${op} failed`, { code: error?.code, name: error?.name })
const sendError = (res, error, fallback) => {
  if (error?.status && error?.response) return res.status(error.status).json(error.response)
  return res.status(500).json({ error: fallback })
}

router.get('/plan', async (req, res) => {
  try {
    res.json(await getPlan(req.user.id))
  } catch (error) {
    safeLog('load', error)
    res.status(500).json({ error: 'Failed to load budget' })
  }
})

router.post('/paydays', async (req, res) => {
  try {
    const result = await createPayday(req.user.id, req.body)
    res.status(result.status).json({ payday: result.entry })
  } catch (error) {
    safeLog('create payday', error)
    sendError(res, error, 'Failed to save budget')
  }
})

router.put('/paydays/:id', async (req, res) => {
  try {
    res.json({ payday: await updatePayday(req.user.id, req.params.id, req.body) })
  } catch (error) {
    safeLog('update payday', error)
    sendError(res, error, 'Failed to save budget')
  }
})

router.delete('/paydays/:id', async (req, res) => {
  try {
    res.json(await deleteNewPayday(req.user.id, req.params.id))
  } catch (error) {
    safeLog('delete payday', error)
    sendError(res, error, 'Failed to delete budget item')
  }
})

router.post('/bills', async (req, res) => {
  try {
    const result = await createBill(req.user.id, req.body)
    res.status(result.status).json({ bill: result.entry })
  } catch (error) {
    safeLog('create bill', error)
    sendError(res, error, 'Failed to save budget')
  }
})

router.put('/bills/:id', async (req, res) => {
  try {
    res.json({ bill: await updateBill(req.user.id, req.params.id, req.body) })
  } catch (error) {
    safeLog('update bill', error)
    sendError(res, error, 'Failed to save budget')
  }
})

router.delete('/bills/:id', async (req, res) => {
  try {
    res.json(await deleteBill(req.user.id, req.params.id))
  } catch (error) {
    safeLog('delete bill', error)
    sendError(res, error, 'Failed to delete budget item')
  }
})

router.get('/', async (req, res) => {
  try {
    res.json(await getBudget(req.user.id))
  } catch (error) {
    safeLog('legacy load', error)
    res.status(500).json({ error: 'Failed to fetch budget data' })
  }
})

router.post('/item', async (req, res) => {
  try {
    res.json(await saveItem(req.user.id, req.body))
  } catch (error) {
    safeLog('legacy save item', error)
    res.status(500).json({ error: 'Failed to save budget item' })
  }
})

router.delete('/item/:id', async (req, res) => {
  try {
    await deleteItem(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    safeLog('legacy delete item', error)
    res.status(500).json({ error: 'Failed to delete budget item' })
  }
})

router.post('/payday', async (req, res) => {
  try {
    res.json(await savePayday(req.user.id, req.body))
  } catch (error) {
    safeLog('legacy save payday', error)
    res.status(500).json({ error: 'Failed to save payday' })
  }
})

router.delete('/payday/:id', async (req, res) => {
  try {
    await deletePayday(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    safeLog('legacy delete payday', error)
    res.status(500).json({ error: 'Failed to delete payday' })
  }
})

export default router
