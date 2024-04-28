import express from 'express'
import { getLicenses, postLicense } from '../services/superMarketService.js'
const router = express.Router()
router.get('/licenses', async (req, res, next) => {
  try {
    res.send(await getLicenses(req.user.id))
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

router.post('/licenses', async (req, res, next) => {
  try {
    res.send(await postLicense(req.user.id, req.body))
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

export default router
