import express from 'express'
import { getBudget, saveItem, deleteItem, savePayday, deletePayday } from '../services/budgetService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    res.json(await getBudget(req.user.id))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch budget data' })
  }
})

router.post('/item', async (req, res) => {
  try {
    res.json(await saveItem(req.user.id, req.body))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to save budget item' })
  }
})

router.delete('/item/:id', async (req, res) => {
  try {
    await deleteItem(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete budget item' })
  }
})

router.post('/payday', async (req, res) => {
  try {
    res.json(await savePayday(req.user.id, req.body))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to save payday' })
  }
})

router.delete('/payday/:id', async (req, res) => {
  try {
    await deletePayday(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete payday' })
  }
})

export default router
