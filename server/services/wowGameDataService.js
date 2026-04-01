import { FieldValue } from '@google-cloud/firestore'
import { db } from '../client/firestoreClient.js'
import { embedText } from './chatbotService.js'
import { splitLargeList } from './wowRagService.js'
import {
  getAchievementIndex,
  getExpansionJournal,
  getCurrentMythicSeason,
  getPlayableClasses,
  getPlayableSpecializations,
  getMythicKeystoneDungeons,
  getJournalInstances,
  getJournalEncounter,
  getReputationFactions,
  getItemSets,
  getProfessions,
  getMountIndex,
  getTitleIndex,
  getToyIndex,
  getPetIndex
} from './wowService.js'

const COLLECTION = 'wow_game_data'
const STALENESS_HOURS = 24
const REGIONS = ['us', 'eu', 'kr', 'tw']

// ─── Freshness check ─────────────────────────────────────────────────────────

async function getLastUpdated (type, region) {
  // Doc IDs are deterministic: ${type}_${region}_${i} — just fetch index 0
  const doc = await db.collection(COLLECTION).doc(`${type}_${region}_0`).get()
  if (!doc.exists) return null
  return doc.data().updatedAt
}

function isStale (updatedAt) {
  if (!updatedAt) return true
  const age = Date.now() - new Date(updatedAt).getTime()
  return age > STALENESS_HOURS * 60 * 60 * 1000
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function deleteGameChunks (type, region) {
  // Doc IDs are deterministic: ${type}_${region}_${i}
  const deletes = []
  let i = 0
  while (true) {
    const ref = db.collection(COLLECTION).doc(`${type}_${region}_${i}`)
    const snap = await ref.get()
    if (!snap.exists) break
    deletes.push(ref.delete())
    i++
  }
  await Promise.all(deletes)
}

async function storeGameChunks (type, region, textChunks) {
  const updatedAt = new Date().toISOString()
  const writes = textChunks.map(async (content, i) => {
    const docId = `${type}_${region}_${i}`
    const embedding = await embedText(content)
    await db.collection(COLLECTION).doc(docId).set({
      content,
      embedding: FieldValue.vector(embedding),
      type,
      region,
      chunkIndex: i,
      updatedAt
    })
  })
  await Promise.all(writes)
  console.log(`[WoW Game Data] Stored ${textChunks.length} chunk(s) for ${type} (${region})`)
}

// ─── Individual data populators ───────────────────────────────────────────────

async function populateAchievements (region, force = false) {
  const lastUpdated = await getLastUpdated('allAchievements', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] allAchievements (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching achievement index (${region})...`)
  const achievements = await getAchievementIndex(region)
  if (!achievements.length) return

  const byCategory = {}
  for (const ach of achievements) {
    const cat = ach.category || 'Uncategorized'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(`  - ${ach.name}`)
  }
  const lines = []
  for (const [cat, entries] of Object.entries(byCategory)) {
    lines.push(`[${cat}]`)
    lines.push(...entries)
  }

  const chunks = splitLargeList('All Achievements in World of Warcraft', lines, achievements.length)
  await deleteGameChunks('allAchievements', region)
  await storeGameChunks('allAchievements', region, chunks)
}

async function populateExpansionInfo (region, force = false) {
  const lastUpdated = await getLastUpdated('expansionInfo', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] expansionInfo (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching expansion journal (${region})...`)
  const [expansionJournal, mythicSeason] = await Promise.all([
    getExpansionJournal(region),
    getCurrentMythicSeason(region)
  ])
  if (!expansionJournal) return

  const dungeonList = expansionJournal.dungeons.length
    ? expansionJournal.dungeons.map(d => `  - ${d}`).join('\n')
    : '  None listed'
  const raidList = expansionJournal.raids.length
    ? expansionJournal.raids.map(r => `  - ${r}`).join('\n')
    : '  None listed'

  let content = `Current Expansion: ${expansionJournal.expansionName}\n\nDungeons:\n${dungeonList}\n\nRaids:\n${raidList}`
  if (mythicSeason?.dungeons?.length) {
    content += '\n\nCurrent Mythic+ Dungeon Pool:\n' +
      mythicSeason.dungeons.map(d => `  - ${d}`).join('\n')
  }

  await deleteGameChunks('expansionInfo', region)
  await storeGameChunks('expansionInfo', region, [content])
}

async function populatePlayableClasses (region, force = false) {
  const lastUpdated = await getLastUpdated('playableClasses', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] playableClasses (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching playable classes (${region})...`)
  const classes = await getPlayableClasses(region)
  if (!classes.length) return

  const lines = classes.map(c =>
    `  - ${c.name} (Power: ${c.powerType}) | Specs: ${c.specs.join(', ')}`
  )
  const chunks = splitLargeList('Playable Classes in World of Warcraft', lines, classes.length)
  await deleteGameChunks('playableClasses', region)
  await storeGameChunks('playableClasses', region, chunks)
}

async function populatePlayableSpecs (region, force = false) {
  const lastUpdated = await getLastUpdated('playableSpecs', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] playableSpecs (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching playable specializations (${region})...`)
  const specs = await getPlayableSpecializations(region)
  if (!specs.length) return

  const lines = specs.map(s =>
    `  - ${s.name} (${s.class}) [${s.role}]${s.description ? ': ' + s.description : ''}`
  )
  const chunks = splitLargeList('Playable Specializations in World of Warcraft', lines, specs.length)
  await deleteGameChunks('playableSpecs', region)
  await storeGameChunks('playableSpecs', region, chunks)
}

async function populateMythicKeystoneDungeons (region, force = false) {
  const lastUpdated = await getLastUpdated('mythicKeystoneDungeons', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] mythicKeystoneDungeons (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching M+ keystone dungeons (${region})...`)
  const dungeons = await getMythicKeystoneDungeons(region)
  if (!dungeons.length) return

  const lines = dungeons.map(d => {
    const upgrades = d.keystoneUpgrades.map(u => {
      const mins = Math.floor(u.qualifyingDurationMs / 60000)
      const secs = String(Math.round((u.qualifyingDurationMs % 60000) / 1000)).padStart(2, '0')
      return `+${u.upgradeLevel} within ${mins}:${secs}`
    }).join(', ')
    return `  - ${d.name}${d.zone ? ' (' + d.zone + ')' : ''}${upgrades ? ' | Upgrades: ' + upgrades : ''}`
  })
  const chunks = splitLargeList('Mythic Keystone Dungeons in World of Warcraft', lines, dungeons.length)
  await deleteGameChunks('mythicKeystoneDungeons', region)
  await storeGameChunks('mythicKeystoneDungeons', region, chunks)
}

async function populateJournalInstances (region, force = false) {
  const lastUpdated = await getLastUpdated('journalInstances', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] journalInstances (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching journal instances (${region})...`)
  const instances = await getJournalInstances(region)
  if (!instances.length) return

  // Fetch all encounter details in parallel
  const allBossIds = instances.flatMap(i => i.bosses.map(b => b.id))
  const encounterDetails = await Promise.all(
    allBossIds.map(id => getJournalEncounter(id, region).catch(() => null))
  )
  const encounterMap = {}
  for (const enc of encounterDetails.filter(Boolean)) {
    encounterMap[enc.id] = enc
  }

  const lines = []
  for (const inst of instances) {
    lines.push(`${inst.name} (${inst.category === 'RAID' ? 'Raid' : 'Dungeon'}):`)
    for (const boss of inst.bosses) {
      lines.push(`  Boss: ${boss.name}`)
      const enc = encounterMap[boss.id]
      if (enc?.sections?.length) {
        for (const sec of enc.sections) {
          lines.push(`    ${sec.title}: ${sec.body}`)
        }
      }
    }
    lines.push('')
  }

  const chunks = splitLargeList('World of Warcraft Dungeons and Raids — Boss Encounters', lines, instances.length)
  await deleteGameChunks('journalInstances', region)
  await storeGameChunks('journalInstances', region, chunks)
}

async function populateReputationFactions (region, force = false) {
  const lastUpdated = await getLastUpdated('reputationFactions', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] reputationFactions (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching reputation factions (${region})...`)
  const factions = await getReputationFactions(region)
  if (!factions.length) return

  const lines = factions.map(f => `  - ${f.name}${f.description ? ': ' + f.description : ''}`)
  const chunks = splitLargeList('Reputation Factions in World of Warcraft', lines, factions.length)
  await deleteGameChunks('reputationFactions', region)
  await storeGameChunks('reputationFactions', region, chunks)
}

async function populateItemSets (region, force = false) {
  const lastUpdated = await getLastUpdated('itemSets', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] itemSets (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching item sets (${region})...`)
  const sets = await getItemSets(region)
  if (!sets.length) return

  const lines = []
  for (const s of sets) {
    const effectStr = s.effects.map(e => `(${e.pieces}pc) ${e.description}`).join(' | ')
    lines.push(`  - ${s.name}${effectStr ? ': ' + effectStr : ''}`)
  }
  const chunks = splitLargeList('Item Sets and Tier Set Bonuses in World of Warcraft', lines, sets.length)
  await deleteGameChunks('itemSets', region)
  await storeGameChunks('itemSets', region, chunks)
}

async function populateProfessions (region, force = false) {
  const lastUpdated = await getLastUpdated('professions', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] professions (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching professions (${region})...`)
  const professions = await getProfessions(region)
  if (!professions.length) return

  const lines = []
  for (const prof of professions) {
    lines.push(`Profession: ${prof.name} (${prof.type})`)
    for (const tier of prof.skillTiers) {
      lines.push(`  [${tier.name}]`)
      for (const recipe of tier.recipes) {
        lines.push(`    - ${recipe}`)
      }
    }
    lines.push('')
  }
  const chunks = splitLargeList('Professions and Recipes in World of Warcraft', lines, professions.length)
  await deleteGameChunks('professions', region)
  await storeGameChunks('professions', region, chunks)
}

async function populateMountIndex (region, force = false) {
  const lastUpdated = await getLastUpdated('mountIndex', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] mountIndex (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching mount index (${region})...`)
  const mounts = await getMountIndex(region)
  if (!mounts.length) return

  const lines = mounts.map(m => `  - ${m.name}`)
  const chunks = splitLargeList('All Collectible Mounts in World of Warcraft', lines, mounts.length)
  await deleteGameChunks('mountIndex', region)
  await storeGameChunks('mountIndex', region, chunks)
}

async function populateTitleIndex (region, force = false) {
  const lastUpdated = await getLastUpdated('titleIndex', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] titleIndex (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching title index (${region})...`)
  const titles = await getTitleIndex(region)
  if (!titles.length) return

  const lines = titles.map(t => `  - ${t.name}`)
  const chunks = splitLargeList('All Character Titles Available in World of Warcraft', lines, titles.length)
  await deleteGameChunks('titleIndex', region)
  await storeGameChunks('titleIndex', region, chunks)
}

async function populateToyAndPetIndex (region, force = false) {
  const lastUpdated = await getLastUpdated('toyPetIndex', region)
  if (!force && !isStale(lastUpdated)) {
    console.log(`[WoW Game Data] toyPetIndex (${region}) is fresh — skipping`)
    return
  }

  console.log(`[WoW Game Data] Fetching toy and pet index (${region})...`)
  const [toys, pets] = await Promise.all([
    getToyIndex(region),
    getPetIndex(region)
  ])

  const lines = []
  if (toys.length) {
    lines.push('Toys:')
    for (const t of toys) lines.push(`  - ${t.name}`)
    lines.push('')
  }
  if (pets.length) {
    lines.push('Battle Pets:')
    for (const p of pets) lines.push(`  - ${p.name}`)
  }
  if (!lines.length) return

  const chunks = splitLargeList('Toys and Battle Pets Available in World of Warcraft', lines, toys.length + pets.length)
  await deleteGameChunks('toyPetIndex', region)
  await storeGameChunks('toyPetIndex', region, chunks)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Populate all global WoW game data for a region.
 * Skips any data type that is still fresh (< 24 hours old) unless its key
 * is included in the forceTypes Set, which bypasses the staleness check.
 * Pass forceTypes = new Set(['all']) to force-refresh everything.
 */
export async function populateGameData (region = 'us', forceTypes = new Set()) {
  const f = t => forceTypes.has(t) || forceTypes.has('all')
  try {
    await Promise.all([
      populateAchievements(region, f('allAchievements')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate achievements (${region}):`, e.message)
      ),
      populateExpansionInfo(region, f('expansionInfo')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate expansion info (${region}):`, e.message)
      ),
      populatePlayableClasses(region, f('playableClasses')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate playable classes (${region}):`, e.message)
      ),
      populatePlayableSpecs(region, f('playableSpecs')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate playable specs (${region}):`, e.message)
      ),
      populateMythicKeystoneDungeons(region, f('mythicKeystoneDungeons')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate M+ dungeons (${region}):`, e.message)
      ),
      populateJournalInstances(region, f('journalInstances')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate journal instances (${region}):`, e.message)
      ),
      populateReputationFactions(region, f('reputationFactions')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate reputation factions (${region}):`, e.message)
      ),
      populateItemSets(region, f('itemSets')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate item sets (${region}):`, e.message)
      ),
      populateProfessions(region, f('professions')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate professions (${region}):`, e.message)
      ),
      populateMountIndex(region, f('mountIndex')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate mount index (${region}):`, e.message)
      ),
      populateTitleIndex(region, f('titleIndex')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate title index (${region}):`, e.message)
      ),
      populateToyAndPetIndex(region, f('toyPetIndex')).catch(e =>
        console.error(`[WoW Game Data] Failed to populate toy/pet index (${region}):`, e.message)
      )
    ])
    console.log(`[WoW Game Data] Population complete for region: ${region}`)
  } catch (e) {
    console.error('[WoW Game Data] Unexpected error during population:', e.message)
  }
}

/**
 * Populate game data for all regions. Called on server startup.
 */
export async function populateAllRegions () {
  await Promise.all(REGIONS.map(r => populateGameData(r)))
}

/**
 * Search global game data chunks relevant to a question.
 * Not filtered by user or character — shared across all users.
 */
export async function searchGameDataChunks (question, region = 'us', limit = 2) {
  const queryEmbedding = await embedText(question)
  const vectorQuery = db.collection(COLLECTION)
    .where('region', '==', region)
    .findNearest('embedding', FieldValue.vector(queryEmbedding), {
      limit,
      distanceMeasure: 'COSINE'
    })
  const snapshot = await vectorQuery.get()
  return snapshot.docs.map(doc => doc.data().content)
}
