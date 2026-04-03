import { OpenAI } from 'openai'
import { searchCharacterChunks, makeCharKey } from './wowRagService.js'
import { searchGameDataChunks } from './wowGameDataService.js'

const openai = new OpenAI({ apiKey: process.env.CHAT_GPT_API_KEY })

// Cache Blizzard token to avoid re-fetching on every request (expires in 24h)
let blizzardToken = null
let blizzardTokenExpiry = 0

async function getBlizzardToken() {
  if (blizzardToken && Date.now() < blizzardTokenExpiry) return blizzardToken

  const credentials = Buffer.from(
    `${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Blizzard OAuth failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  blizzardToken = data.access_token
  // Expire 5 minutes early to be safe
  blizzardTokenExpiry = Date.now() + (data.expires_in - 300) * 1000
  return blizzardToken
}

function realmSlug(realm) {
  return realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')
}

async function blizzardFetch(path, region, token, namespace = null) {
  const ns = namespace || `profile-${region}`
  const url = `https://${region}.api.blizzard.com${path}?namespace=${ns}&locale=en_US`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    if (res.status === 404) return null
    const text = await res.text()
    throw new Error(`Blizzard API error ${res.status}: ${text}`)
  }
  return res.json()
}

// Simple in-process cache for static game data (rarely changes — 1 hour TTL)
const staticCache = {}
async function blizzardStaticFetch(path, region, token) {
  const key = `${region}:${path}`
  const cached = staticCache[key]
  if (cached && Date.now() < cached.expiry) return cached.data
  const data = await blizzardFetch(path, region, token, `static-${region}`)
  if (data) staticCache[key] = { data, expiry: Date.now() + 3600 * 1000 }
  return data
}

// ─── Game data fetchers ──────────────────────────────────────────────────────

// Fetch full details for a list of achievement IDs in parallel (batched)
async function fetchAchievementDetails(ids, region, token) {
  const unique = [...new Set(ids)]
  const results = await Promise.all(
    unique.map(id =>
      blizzardStaticFetch(`/data/wow/achievement/${id}`, region, token).catch(() => null)
    )
  )
  return results.filter(Boolean)
}

// Returns { expansionName, dungeons, raids } for the current expansion
export async function getExpansionJournal(region = 'us') {
  const token = await getBlizzardToken()

  // Fetch the expansion index to find the latest one
  const index = await blizzardStaticFetch('/data/wow/journal-expansion/index', region, token)
  if (!index?.tiers) return null

  // The last entry in the index is the most recent expansion
  const latest = index.tiers[index.tiers.length - 1]
  const expansion = await blizzardStaticFetch(`/data/wow/journal-expansion/${latest.id}`, region, token)
  if (!expansion) return null

  const dungeons = (expansion.dungeons || []).map(d => d.name).filter(Boolean)
  const raids = (expansion.raids || []).map(r => r.name).filter(Boolean)

  return {
    expansionName: expansion.name,
    expansionId: latest.id,
    dungeons,
    raids
  }
}

// Returns current M+ season info: season name + dungeon pool
export async function getCurrentMythicSeason(region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/mythic-keystone/season/index', region, token)
  if (!index?.current_season?.id) return null

  const season = await blizzardStaticFetch(
    `/data/wow/mythic-keystone/season/${index.current_season.id}`, region, token
  )
  if (!season) return null

  return {
    seasonId: season.id,
    startTimestamp: season.start_timestamp,
    dungeons: (season.mythic_keystone_dungeons || []).map(d => d.dungeon?.name).filter(Boolean)
  }
}

// Returns all achievement categories + achievements with mount/title reward flags
export async function getAchievementIndex(region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/achievement-category/index', region, token)
  if (!index?.root_categories) return []

  // Fetch all top-level category details in parallel
  const categories = await Promise.all(
    index.root_categories.map(cat =>
      blizzardStaticFetch(`/data/wow/achievement-category/${cat.id}`, region, token).catch(() => null)
    )
  )

  // Collect all subcategory IDs from every top-level category, then fetch all in parallel
  const subIds = []
  for (const cat of categories.filter(Boolean)) {
    for (const sub of (cat.subcategories || [])) subIds.push(sub.id)
  }
  const subCategories = await Promise.all(
    subIds.map(id =>
      blizzardStaticFetch(`/data/wow/achievement-category/${id}`, region, token).catch(() => null)
    )
  )

  const achievements = []

  for (const cat of categories.filter(Boolean)) {
    for (const ach of (cat.achievements || [])) {
      if (ach.name) achievements.push({ id: ach.id, name: ach.name, category: cat.name })
    }
  }
  for (const subCat of subCategories.filter(Boolean)) {
    for (const ach of (subCat.achievements || [])) {
      if (ach.name) achievements.push({ id: ach.id, name: ach.name, category: subCat.name })
    }
  }

  return achievements
}

// ─── Character data fetchers ─────────────────────────────────────────────────

// Returns completed achievements for a character with timestamps
export async function getCharacterAchievements(name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/achievements`,
    region, token
  )
  if (!data?.achievements) return []

  return data.achievements
    .filter(a => a.completed_timestamp)
    .map(a => ({
      id: a.id,
      name: a.achievement?.name || null,
      completedAt: a.completed_timestamp
    }))
}

// Returns mounts collected by the character
export async function getCharacterMounts(name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/collections/mounts`,
    region, token
  )
  if (!data?.mounts) return []
  return data.mounts.map(m => m.mount?.name).filter(Boolean)
}

const SLOT_ORDER = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST',
  'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET',
  'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2',
  'MAIN_HAND', 'OFF_HAND'
]

const SLOT_LABELS = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulders', BACK: 'Back',
  CHEST: 'Chest', WRIST: 'Wrist', HANDS: 'Hands', WAIST: 'Waist',
  LEGS: 'Legs', FEET: 'Feet', FINGER_1: 'Ring 1', FINGER_2: 'Ring 2',
  TRINKET_1: 'Trinket 1', TRINKET_2: 'Trinket 2',
  MAIN_HAND: 'Main Hand', OFF_HAND: 'Off Hand'
}

function parseEquipment(equipData) {
  if (!equipData?.equipped_items) return { slots: [], avgEquipped: 0 }

  const slots = equipData.equipped_items.map(item => ({
    slot: item.slot?.type || 'UNKNOWN',
    label: SLOT_LABELS[item.slot?.type] || item.slot?.name || item.slot?.type,
    name: item.name,
    ilvl: item.level?.value || 0,
    quality: item.quality?.type || 'COMMON'
  }))

  // Sort by SLOT_ORDER
  slots.sort((a, b) => {
    const ai = SLOT_ORDER.indexOf(a.slot)
    const bi = SLOT_ORDER.indexOf(b.slot)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const ilvls = slots.map(s => s.ilvl).filter(i => i > 0)
  const avgEquipped = ilvls.length ? Math.round(ilvls.reduce((a, b) => a + b, 0) / ilvls.length) : 0

  return { slots, avgEquipped }
}

function parseSpecializations(specData) {
  if (!specData?.specializations) return null
  const active = specData.specializations.find(s => s.specialization)
  if (!active) return null
  return {
    name: active.specialization?.name || 'Unknown',
    id: active.specialization?.id
  }
}

async function getRaiderIOData(region, realm, name) {
  const fields = [
    'mythic_plus_scores_by_season:current',
    'raid_progression',
    'mythic_plus_recent_runs:5'
  ].join(',')

  const url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(name)}&fields=${encodeURIComponent(fields)}`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getCharacterData(name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const nameLower = name.toLowerCase()
  const basePath = `/profile/wow/character/${slug}/${nameLower}`

  const [profile, equipment, specializations, raiderIO] = await Promise.all([
    blizzardFetch(basePath, region, token),
    blizzardFetch(`${basePath}/equipment`, region, token),
    blizzardFetch(`${basePath}/specializations`, region, token),
    getRaiderIOData(region, realm, name)
  ])

  if (!profile) {
    throw new Error(`Character "${name}" on "${realm}" (${region.toUpperCase()}) not found. Check the name, realm, and region.`)
  }

  const { slots, avgEquipped } = parseEquipment(equipment)
  const activeSpec = parseSpecializations(specializations)

  const avgIlvl = profile.average_item_level || avgEquipped
  const equippedIlvl = profile.equipped_item_level || avgEquipped
  const weakSlots = slots.filter(s => s.ilvl > 0 && s.ilvl < equippedIlvl - 10)

  // Mythic+ score
  const mPlusScores = raiderIO?.mythic_plus_scores_by_season
  const currentScore = mPlusScores && mPlusScores.length > 0
    ? mPlusScores[0]?.scores?.all ?? 0
    : 0

  // Recent runs
  const recentRuns = (raiderIO?.mythic_plus_recent_runs || []).map(run => ({
    dungeon: run.dungeon,
    keystoneLevel: run.mythic_level,
    score: run.score,
    completedAt: run.completed_at
  }))

  // Raid progress
  const raidProgress = raiderIO?.raid_progression
    ? Object.entries(raiderIO.raid_progression).map(([raid, data]) => ({
        raid,
        summary: data.summary
      }))
    : []

  return {
    name: profile.name,
    realm: profile.realm?.name || realm,
    region: region.toUpperCase(),
    level: profile.level,
    class: profile.character_class?.name || 'Unknown',
    race: profile.race?.name || 'Unknown',
    faction: profile.faction?.name || 'Unknown',
    spec: activeSpec?.name || profile.active_spec?.name || 'Unknown',
    avgIlvl,
    equippedIlvl,
    slots,
    weakSlots,
    mPlusScore: Math.round(currentScore),
    recentRuns,
    raidProgress
  }
}

function buildSystemPrompt(characterData) {
  const { name, realm, region, level, class: cls, race, spec, avgIlvl, equippedIlvl, slots, weakSlots, mPlusScore, recentRuns, raidProgress } = characterData

  const slotTable = slots.map(s => `  ${s.label.padEnd(12)} ${s.ilvl}`).join('\n')

  const weakSlotList = weakSlots.length > 0
    ? weakSlots.map(s => `  ${s.label}: ${s.ilvl} ilvl (${equippedIlvl - s.ilvl} below avg)`).join('\n')
    : '  None — all slots near average'

  const recentRunsText = recentRuns.length > 0
    ? recentRuns.map(r => `  +${r.keystoneLevel} ${r.dungeon}`).join('\n')
    : '  No recent M+ runs found'

  const raidText = raidProgress.length > 0
    ? raidProgress.map(r => `  ${r.raid}: ${r.summary}`).join('\n')
    : '  No raid data found'

  return `You are an expert World of Warcraft advisor for the Midnight expansion (patch 12.x).
The expansion is called "Midnight" — do not call it anything else (not "Shadowlands", not "Midnight Isles", not any other name).
Midnight is set in Quel'Thalas and the surrounding Blood Elf territories.
Give specific, actionable advice to help this player improve their character.

You have deep, comprehensive knowledge of all WoW items, quests, achievements, collectibles, and game systems — use this knowledge confidently, especially for inventory and bag management questions.
When asked about specific items in the player's inventory:
- Draw on your WoW knowledge to assess whether the item is needed for achievements, quests, collection systems (mounts, pets, toys, transmog), crafting, or anything else worth keeping
- Be direct: tell them to vendor/delete it if it serves no notable purpose, or explain specifically why they should keep it
- If an item is genuinely unknown to you, say so and suggest they check Wowhead

CHARACTER:
  ${name} on ${realm}-${region} | ${race} ${cls} — ${spec} spec | Level ${level}
  Average Item Level: ${avgIlvl} | Equipped Item Level: ${equippedIlvl}
  Mythic+ Score: ${mPlusScore} (Current Season)

GEAR BREAKDOWN (item level per slot):
${slotTable}

WEAK SLOTS (more than 10 ilvl below equipped avg):
${weakSlotList}

RECENT MYTHIC+ RUNS:
${recentRunsText}

RAID PROGRESS:
${raidText}

When giving advice:
- Be specific: name actual dungeons, bosses, M+ key levels, and exact gear slots
- Prioritize the biggest ilvl gains first
- Consider their M+ score when recommending key levels to push
- For inventory cleanup questions, go through the player's bag items systematically and flag anything worth keeping with a clear reason
- Keep responses concise and practical`
}

export async function streamWoWChat(message, characterData, history, userId, res) {
  const region = (characterData.region || 'us').toLowerCase()

  const charKey = makeCharKey(characterData.region, characterData.realm, characterData.name)

  // Search both collections in parallel — character-specific + global game data
  const [charChunks, gameChunks] = await Promise.allSettled([
    searchCharacterChunks(message, userId, charKey, 6),
    searchGameDataChunks(message, region, 4)
  ])

  const characterContext = charChunks.status === 'fulfilled' && charChunks.value.length
    ? '\n\nCHARACTER CONTEXT (from saved character data):\n' + charChunks.value.join('\n\n---\n')
    : ''
  const gameContext = gameChunks.status === 'fulfilled' && gameChunks.value.length
    ? '\n\nGAME KNOWLEDGE:\n' + gameChunks.value.join('\n\n---\n')
    : ''

  const systemPrompt = buildSystemPrompt(characterData) + characterContext + gameContext

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ]

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const stream = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages,
    stream: true
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || ''
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`)
    }
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

// ─── Extended game data fetchers ─────────────────────────────────────────────

// Returns all playable classes with their specs and power type
export async function getPlayableClasses (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/playable-class/index', region, token)
  if (!index?.classes) return []

  const classes = await Promise.all(
    index.classes.map(c =>
      blizzardStaticFetch(`/data/wow/playable-class/${c.id}`, region, token).catch(() => null)
    )
  )

  return classes.filter(Boolean).map(c => ({
    id: c.id,
    name: c.name,
    powerType: c.power_type?.name || 'Unknown',
    specs: (c.specializations || []).map(s => s.name).filter(Boolean)
  }))
}

// Returns all playable specializations with role and description
export async function getPlayableSpecializations (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/playable-specialization/index', region, token)
  if (!index?.character_specializations) return []

  const specs = await Promise.all(
    index.character_specializations.map(s =>
      blizzardStaticFetch(`/data/wow/playable-specialization/${s.id}`, region, token).catch(() => null)
    )
  )

  return specs.filter(Boolean).map(s => ({
    id: s.id,
    name: s.name,
    class: s.playable_class?.name || 'Unknown',
    role: s.role?.name || s.role?.type || 'Unknown',
    description: s.description || ''
  }))
}

// Returns all M+ keystone dungeons with upgrade thresholds
export async function getMythicKeystoneDungeons (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/mythic-keystone/dungeon/index', region, token)
  if (!index?.dungeons) return []

  const dungeons = await Promise.all(
    index.dungeons.map(d =>
      blizzardStaticFetch(`/data/wow/mythic-keystone/dungeon/${d.id}`, region, token).catch(() => null)
    )
  )

  return dungeons.filter(Boolean).map(d => ({
    id: d.id,
    name: d.name,
    zone: d.zone?.name || '',
    keystoneUpgrades: (d.keystone_upgrades || []).map(u => ({
      upgradeLevel: u.upgrade_level,
      qualifyingDurationMs: u.qualifying_duration
    }))
  }))
}

// Returns all journal instances (dungeons + raids) with their boss names and IDs
export async function getJournalInstances (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/journal-instance/index', region, token)
  if (!index?.instances) return []

  const instances = await Promise.all(
    index.instances.map(i =>
      blizzardStaticFetch(`/data/wow/journal-instance/${i.id}`, region, token).catch(() => null)
    )
  )

  return instances.filter(Boolean).map(inst => ({
    id: inst.id,
    name: inst.name,
    category: inst.category?.type || 'DUNGEON',
    bosses: (inst.encounters || []).map(e => ({ id: e.id, name: e.name }))
  }))
}

// Returns ability section details for a single journal encounter (boss)
export async function getJournalEncounter (id, region = 'us') {
  const token = await getBlizzardToken()
  const data = await blizzardStaticFetch(`/data/wow/journal-encounter/${id}`, region, token)
  if (!data) return null
  const stripHtml = str =>
    str.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()
  return {
    id: data.id,
    name: data.name,
    instance: data.instance?.name || '',
    sections: (data.sections || [])
      .map(s => ({ title: s.title || '', body: s.body_text ? stripHtml(s.body_text) : '' }))
      .filter(s => s.body)
  }
}

// Returns all reputation factions with descriptions
export async function getReputationFactions (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/reputation-faction/index', region, token)
  if (!index?.factions) return []
  return index.factions.map(f => ({ id: f.id, name: f.name, description: f.description || '' }))
}

// Returns item sets (tier sets) with set bonus descriptions resolved from spell data
export async function getItemSets (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/item-set/index', region, token)
  if (!index?.item_sets) return []

  const sets = await Promise.all(
    index.item_sets.map(s =>
      blizzardStaticFetch(`/data/wow/item-set/${s.id}`, region, token).catch(() => null)
    )
  )

  const validSets = sets.filter(Boolean)

  // Collect all unique spell IDs referenced by set effects so we can resolve descriptions
  const spellIds = new Set()
  for (const s of validSets) {
    for (const e of (s.effects || [])) {
      if (e.spell?.id) spellIds.add(e.spell.id)
    }
  }

  // Fetch all spell details in parallel — descriptions live here, not on the item set
  const spellDetails = await Promise.all(
    [...spellIds].map(id =>
      blizzardStaticFetch(`/data/wow/spell/${id}`, region, token).catch(() => null)
    )
  )
  const spellMap = {}
  for (const spell of spellDetails.filter(Boolean)) {
    spellMap[spell.id] = spell.description || ''
  }

  return validSets.map(s => ({
    id: s.id,
    name: s.name,
    items: (s.items || []).map(i => i.name).filter(Boolean),
    effects: (s.effects || [])
      .map(e => ({
        pieces: e.required_count,
        // Blizzard uses display_string on effects, description on spells — check all three
        description: e.display_string || e.description || (e.spell?.id ? spellMap[e.spell.id] : '') || ''
      }))
      .filter(e => e.description)
  }))
}

// Returns all professions with their skill tiers and recipe lists
export async function getProfessions (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/profession/index', region, token)
  if (!index?.professions) return []

  const professions = await Promise.all(
    index.professions.map(p =>
      blizzardStaticFetch(`/data/wow/profession/${p.id}`, region, token).catch(() => null)
    )
  )

  const result = []
  for (const prof of professions.filter(Boolean)) {
    const skillTiers = await Promise.all(
      (prof.skill_tiers || []).map(tier =>
        blizzardStaticFetch(`/data/wow/profession/${prof.id}/skill-tier/${tier.id}`, region, token).catch(() => null)
      )
    )
    result.push({
      id: prof.id,
      name: prof.name,
      type: prof.type?.type || 'PROFESSION',
      skillTiers: skillTiers.filter(Boolean).map(tier => ({
        name: tier.name,
        recipes: (tier.categories || [])
          .flatMap(cat => (cat.recipes || []).map(r => r.name).filter(Boolean))
      }))
    })
  }
  return result
}

// Returns all collectible mounts
export async function getMountIndex (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/mount/index', region, token)
  if (!index?.mounts) return []
  return index.mounts.map(m => ({ id: m.id, name: m.name }))
}

// Returns all character titles
export async function getTitleIndex (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/title/index', region, token)
  if (!index?.titles) return []
  return index.titles.map(t => ({ id: t.id, name: t.name }))
}

// Returns all collectible toys
export async function getToyIndex (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/toy/index', region, token)
  if (!index?.toys) return []
  return index.toys.map(t => ({ id: t.id, name: t.item?.name || '' })).filter(t => t.name)
}

// Returns all battle pets
export async function getPetIndex (region = 'us') {
  const token = await getBlizzardToken()
  const index = await blizzardStaticFetch('/data/wow/pet/index', region, token)
  if (!index?.pets) return []
  return index.pets.map(p => ({ id: p.id, name: p.name }))
}

// ─── Additional character data fetchers ──────────────────────────────────────

// Returns the character's reputation standings with all factions
export async function getCharacterReputations (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/reputations`,
    region, token
  )
  if (!data?.reputations) return []
  return data.reputations.map(r => ({
    faction: r.faction?.name || 'Unknown',
    standing: r.standing?.name || 'Unknown',
    value: r.standing?.value || 0,
    max: r.standing?.max || 0,
    renown: r.paragon?.value != null ? { value: r.paragon.value, cap: r.paragon.cap } : null
  }))
}

// Returns the character's M+ keystone profile: season score and best runs per dungeon
export async function getCharacterMythicKeystoneProfile (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/mythic-keystone-profile`,
    region, token
  )
  if (!data) return null

  const seasonScores = (data.current_mythic_rating
    ? [{ season: 'current', score: Math.round(data.current_mythic_rating.rating) }]
    : [])

  const bestRuns = (data.best_runs || []).map(r => ({
    dungeon: r.dungeon?.name || 'Unknown',
    keystoneLevel: r.keystone_level,
    duration: r.duration,
    completedAt: r.completed_timestamp,
    isTimedRun: r.is_completed_within_time
  }))

  return { seasonScores, bestRuns }
}

// Returns the character's professions with skill level and tier details
export async function getCharacterProfessions (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/professions`,
    region, token
  )
  if (!data?.primaries && !data?.secondaries) return { primaries: [], secondaries: [] }

  const mapProf = p => ({
    name: p.profession?.name || 'Unknown',
    skillPoints: p.skill_points || 0,
    maxSkillPoints: p.max_skill_points || 0,
    tiers: (p.tiers || []).map(t => ({
      name: t.tier?.name || '',
      skillPoints: t.skill_points || 0,
      maxSkillPoints: t.max_skill_points || 0
    }))
  })

  return {
    primaries: (data.primaries || []).map(mapProf),
    secondaries: (data.secondaries || []).map(mapProf)
  }
}

// Returns the character's active talent build (selected talents only)
export async function getCharacterTalents (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/specializations`,
    region, token
  )
  if (!data?.specializations) return null

  const active = data.specializations.find(s => s.specialization)
  if (!active) return null

  const talents = (active.talents || [])
    .filter(t => t.talent?.name)
    .map(t => ({
      name: t.talent.name,
      rank: t.rank || 1
    }))

  const pvpTalents = (active.pvp_talent_slots || [])
    .filter(s => s.selected?.talent?.name)
    .map(s => s.selected.talent.name)

  return {
    spec: active.specialization?.name || 'Unknown',
    talents,
    pvpTalents
  }
}

// Returns the character's PvP summary: honor level and bracket ratings
export async function getCharacterPvpSummary (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/pvp-summary`,
    region, token
  )
  if (!data) return null

  return {
    honorLevel: data.honor_level || 0,
    honorableKills: data.honorable_kills || 0,
    brackets: (data.brackets || []).map(b => ({
      bracket: b.bracket?.type || 'Unknown',
      rating: b.rating || 0,
      seasonPlayed: b.season_played || 0,
      seasonWon: b.season_won || 0,
      weeklyPlayed: b.weekly_played || 0,
      weeklyWon: b.weekly_won || 0
    }))
  }
}

// Returns the character's collected pets
export async function getCharacterPets (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/collections/pets`,
    region, token
  )
  if (!data?.pets) return []
  return data.pets.map(p => p.species?.name).filter(Boolean)
}

// Returns the character's collected toys
export async function getCharacterToys (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/collections/toys`,
    region, token
  )
  if (!data?.toys) return []
  return data.toys.map(t => t.toy?.name || t.item?.name).filter(Boolean)
}

// Returns the character's earned titles
export async function getCharacterTitles (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/titles`,
    region, token
  )
  if (!data?.titles) return []
  return data.titles.map(t => t.name).filter(Boolean)
}

// Returns the character's primary statistics (strength, intellect, armor, etc.)
export async function getCharacterStatistics (name, realm, region = 'us') {
  const token = await getBlizzardToken()
  const slug = realmSlug(realm)
  const data = await blizzardFetch(
    `/profile/wow/character/${slug}/${name.toLowerCase()}/statistics`,
    region, token
  )
  if (!data) return null
  return {
    health: data.health || 0,
    power: data.power || 0,
    powerType: data.power_type?.name || '',
    strength: data.strength?.effective || 0,
    agility: data.agility?.effective || 0,
    intellect: data.intellect?.effective || 0,
    stamina: data.stamina?.effective || 0,
    armor: data.armor?.effective || 0,
    critChance: data.melee_crit?.value || 0,
    hasteRating: data.melee_haste?.rating || 0,
    hasteValue: data.melee_haste?.value || 0,
    masteryValue: data.mastery?.value || 0,
    versatilityDmg: data.versatility_damage_done_bonus || 0,
    versatilityHeal: data.versatility_healing_done_bonus || 0,
    versatilityMitigation: data.versatility_damage_taken_bonus || 0,
    spellCrit: data.spell_crit?.value || 0,
    spellHaste: data.spell_haste?.value || 0
  }
}
