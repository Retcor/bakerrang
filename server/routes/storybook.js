import express from 'express'
import { getStorybooks, saveStorybook, deleteStorybook } from '../services/storybookService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    res.json(await getStorybooks(req.user.id))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch storybooks' })
  }
})

router.post('/', async (req, res) => {
  try {
    res.json(await saveStorybook(req.user.id, req.body))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to save storybook' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteStorybook(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to delete storybook' })
  }
})

export default router
