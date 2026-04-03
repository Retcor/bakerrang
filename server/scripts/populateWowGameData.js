/**
 * WoW Game Data population script — run manually whenever you want to refresh
 * the global WoW knowledge base in Firestore (wow_game_data collection).
 *
 * Usage (from the server/ directory):
 *   node scripts/populateWowGameData.js                        — all regions, staleness check
 *   node scripts/populateWowGameData.js us                     — single region, staleness check
 *   node scripts/populateWowGameData.js us eu                  — specific regions, staleness check
 *   node scripts/populateWowGameData.js us --customTierSets    — force-refresh customTierSets for us only
 *   node scripts/populateWowGameData.js us --customTierSets --professions  — force multiple types
 *   node scripts/populateWowGameData.js --force                — force-refresh ALL types, all regions
 *   node scripts/populateWowGameData.js us --force             — force-refresh ALL types for us only
 *
 * Available --type flags:
 *   --allAchievements       --expansionInfo         --playableClasses
 *   --playableSpecs         --mythicKeystoneDungeons  --journalInstances
 *   --reputationFactions    --customTierSets        --professions
 *   --mountIndex            --titleIndex            --toyPetIndex
 *   --force                 (shorthand for all of the above)
 *
 * Prerequisites:
 *   1. CHAT_GPT_API_KEY must be set in .env (used for text-embedding-3-small)
 *   2. BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET must be set in .env
 *   3. Firestore credentials must be configured (gcloud auth application-default login)
 *   4. The wow_game_data Firestore vector index must exist (see README)
 */

import 'dotenv/config'
import { populateGameData } from '../services/wowGameDataService.js'

const VALID_REGIONS = ['us', 'eu', 'kr', 'tw']

const VALID_TYPES = [
  'allAchievements',
  'expansionInfo',
  'playableClasses',
  'playableSpecs',
  'mythicKeystoneDungeons',
  'journalInstances',
  'reputationFactions',
  'customTierSets',
  'professions',
  'mountIndex',
  'titleIndex',
  'toyPetIndex'
]

const args = process.argv.slice(2)
const regionArgs = args.filter(a => VALID_REGIONS.includes(a.toLowerCase()))
const regions = regionArgs.length > 0 ? regionArgs.map(r => r.toLowerCase()) : VALID_REGIONS

// Build the forceTypes set from --flagName args
const forceTypes = new Set()
if (args.includes('--force')) {
  forceTypes.add('all')
} else {
  for (const arg of args) {
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    if (VALID_TYPES.includes(key)) {
      forceTypes.add(key)
    } else if (key !== 'force') {
      console.warn(`Unknown flag: ${arg}  (valid types: ${VALID_TYPES.map(t => '--' + t).join(', ')})`)
    }
  }
}

const forceDesc = forceTypes.size === 0
  ? 'staleness check enabled'
  : forceTypes.has('all')
    ? 'FORCE refresh all types'
    : `FORCE refresh: ${[...forceTypes].join(', ')}`

console.log(`Populating WoW game data for region(s): ${regions.join(', ')} (${forceDesc})\n`)

if (!forceTypes.has('all') && !forceTypes.has('journalInstances')) {
  console.log('Tip: journal instances is the slowest type — use --journalInstances to force-refresh it specifically.\n')
}

const start = Date.now()

Promise.all(regions.map(r => populateGameData(r, forceTypes)))
  .then(() => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`\nPopulation complete in ${elapsed}s.`)
    process.exit(0)
  })
  .catch(err => {
    console.error('\nPopulation failed:', err.message)
    process.exit(1)
  })
