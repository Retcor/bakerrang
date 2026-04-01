import express from 'express'
import {
  getCharacterData,
  streamWoWChat,
  getCharacterAchievements,
  getCharacterMounts,
  getCharacterReputations,
  getCharacterMythicKeystoneProfile,
  getCharacterProfessions,
  getCharacterTalents,
  getCharacterPvpSummary,
  getCharacterPets,
  getCharacterToys,
  getCharacterTitles,
  getCharacterStatistics
} from '../services/wowService.js'
import { buildAndStoreCharacterChunks, getCharacterSavedMeta, makeCharKey } from '../services/wowRagService.js'
import { isAuthenticated } from './auth.js'

const router = express.Router()

// GET /wow/character?name=&realm=&region=
// Fetches character data from Blizzard API + RaiderIO
router.get('/character', async (req, res) => {
  const { name, realm, region = 'us' } = req.query

  if (!name || !realm) {
    return res.status(400).json({ error: 'name and realm are required' })
  }

  const validRegions = ['us', 'eu', 'kr', 'tw']
  if (!validRegions.includes(region.toLowerCase())) {
    return res.status(400).json({ error: `region must be one of: ${validRegions.join(', ')}` })
  }

  if (!process.env.BLIZZARD_CLIENT_ID || !process.env.BLIZZARD_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Blizzard API credentials not configured on server' })
  }

  try {
    const characterData = await getCharacterData(name.trim(), realm.trim(), region.toLowerCase())
    res.json(characterData)
  } catch (err) {
    console.error('WoW character fetch error:', err.message)
    // Surface user-friendly messages (character not found vs server error)
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    res.status(500).json({ error: 'Failed to fetch character data. Please try again.' })
  }
})

// POST /wow/chat
// Body: { message: string, characterData: object, history: [{role, content}] }
// Returns: SSE stream of { text } chunks, ending with [DONE]
router.post('/chat', async (req, res) => {
  const { message, characterData, history = [] } = req.body

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  if (!characterData || typeof characterData !== 'object') {
    return res.status(400).json({ error: 'characterData is required' })
  }

  const userId = req.user?.id || null

  try {
    await streamWoWChat(message.trim(), characterData, history, userId, res)
  } catch (err) {
    console.error('WoW chat error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate response. Please try again.' })
    }
  }
})

// POST /wow/character/persist
// Auth required. Fetches Blizzard API enrichment data, embeds and stores all chunks.
// Body: { characterData: object, addonData?: object }
router.post('/character/persist', isAuthenticated, async (req, res) => {
  const { characterData, addonData } = req.body
  if (!characterData) return res.status(400).json({ error: 'characterData required' })

  const { name, realm, region = 'us' } = characterData

  try {
    // Fetch character-specific Blizzard data in parallel — all non-fatal.
    // Global game data (achievements index, expansion info) is handled separately
    // by wowGameDataService and populated once on startup, shared across all users.
    const [
      completedAchievements,
      collectedMounts,
      reputations,
      mythicKeystoneProfile,
      professions,
      talents,
      pvpSummary,
      collectedPets,
      collectedToys,
      earnedTitles,
      statistics
    ] = await Promise.all([
      getCharacterAchievements(name, realm, region).catch(() => []),
      getCharacterMounts(name, realm, region).catch(() => []),
      getCharacterReputations(name, realm, region).catch(() => []),
      getCharacterMythicKeystoneProfile(name, realm, region).catch(() => null),
      getCharacterProfessions(name, realm, region).catch(() => null),
      getCharacterTalents(name, realm, region).catch(() => null),
      getCharacterPvpSummary(name, realm, region).catch(() => null),
      getCharacterPets(name, realm, region).catch(() => []),
      getCharacterToys(name, realm, region).catch(() => []),
      getCharacterTitles(name, realm, region).catch(() => []),
      getCharacterStatistics(name, realm, region).catch(() => null)
    ])

    const blizzardData = {
      completedAchievements,
      collectedMounts,
      reputations,
      mythicKeystoneProfile,
      professions,
      talents,
      pvpSummary,
      collectedPets,
      collectedToys,
      earnedTitles,
      statistics
    }
    const charKey = await buildAndStoreCharacterChunks(req.user.id, characterData, addonData, blizzardData)
    res.json({ ok: true, charKey })
  } catch (err) {
    console.error('WoW persist error:', err.message)
    res.status(500).json({ error: 'Failed to persist character data' })
  }
})

// GET /wow/character/saved?name=&realm=&region=
// Auth required. Returns { saved: { updatedAt, charKey } } or { saved: null }.
router.get('/character/saved', isAuthenticated, async (req, res) => {
  const { name, realm, region = 'us' } = req.query
  if (!name || !realm) return res.status(400).json({ error: 'name and realm required' })
  try {
    const charKey = makeCharKey(region, realm, name)
    const meta = await getCharacterSavedMeta(req.user.id, charKey)
    res.json({ saved: meta })
  } catch (err) {
    console.error('WoW saved check error:', err.message)
    res.status(500).json({ error: 'Failed to check saved data' })
  }
})

export default router
