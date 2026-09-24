import express from 'express'
import {
  deleteStorybook,
  getStorybook,
  getStorybooks,
  renameStorybook,
  saveStorybook
} from '../services/storybookService.js'

const router = express.Router()

const sendError = (res, error, fallback) => {
  if (error.status) return res.status(error.status).json({ error: error.message })
  console.error(error)
  return res.status(500).json({ error: fallback })
}

router.get('/', async (req, res) => {
  try {
    const summary = req.query.view === 'summary'
    if (summary) res.set('Cache-Control', 'no-store')
    res.json(await getStorybooks(req.user.id, { summary }))
  } catch (error) {
    sendError(res, error, 'Failed to fetch storybooks')
  }
})

router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await getStorybook(req.user.id, req.params.id))
  } catch (error) {
    sendError(res, error, 'Failed to fetch storybook')
  }
})

router.post('/', async (req, res) => {
  try {
    res.json(await saveStorybook(req.user.id, req.body))
  } catch (error) {
    sendError(res, error, 'Failed to save storybook')
  }
})

router.patch('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await renameStorybook(req.user.id, req.params.id, req.body))
  } catch (error) {
    sendError(res, error, 'Failed to rename storybook')
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteStorybook(req.user.id, req.params.id)
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Failed to delete storybook')
  }
})

export default router
