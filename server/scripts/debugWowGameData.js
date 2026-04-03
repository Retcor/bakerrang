/**
 * Debug script — inspect what is stored in wow_game_data for a given type,
 * or print raw item set data as fetched by the service layer.
 *
 * Usage (from the server/ directory):
 *   node scripts/debugWowGameData.js itemSets us         — print stored Firestore chunks
 *   node scripts/debugWowGameData.js itemSets us --raw   — fetch from Blizzard via getItemSets() and print raw result
 *   node scripts/debugWowGameData.js expansionInfo us    — print stored chunks for any type
 */

import 'dotenv/config'
import { db } from '../client/firestoreClient.js'
import { getItemSets } from '../services/wowService.js'

const [type, region = 'us', flag] = process.argv.slice(2)
if (!type) {
  console.error('Usage: node scripts/debugWowGameData.js <type> [region] [--raw]')
  process.exit(1)
}

const COLLECTION = 'wow_game_data'

async function printStoredChunks () {
  console.log(`\n=== Stored chunks for type="${type}" region="${region}" ===\n`)
  let i = 0
  let found = 0
  while (true) {
    const doc = await db.collection(COLLECTION).doc(`${type}_${region}_${i}`).get()
    if (!doc.exists) break
    found++
    console.log(`--- chunk ${i} ---`)
    console.log(doc.data().content)
    console.log()
    i++
  }
  if (!found) {
    console.log(`No chunks found. Run the population script:\n  node scripts/populateWowGameData.js ${region} --${type}`)
  } else {
    console.log(`Total chunks: ${found}`)
  }
}

async function printRawItemSets () {
  console.log(`\n=== Raw getItemSets() output for region="${region}" (first 5 sets) ===\n`)
  const sets = await getItemSets(region)
  console.log(`Total sets returned: ${sets.length}`)
  console.log(`Sets with effects: ${sets.filter(s => s.effects.length > 0).length}\n`)

  const sample = sets.slice(0, 5)
  for (const s of sample) {
    console.log(`Set: ${s.name} (id: ${s.id})`)
    console.log(`  Items: ${s.items.slice(0, 3).join(', ')}${s.items.length > 3 ? '...' : ''}`)
    if (s.effects.length === 0) {
      console.log('  Effects: (none — description fields were all empty)')
    } else {
      for (const e of s.effects) {
        console.log(`  ${e.pieces}pc: ${e.description}`)
      }
    }
    console.log()
  }
}

async function main () {
  if (flag === '--raw') {
    await printRawItemSets()
  } else {
    await printStoredChunks()
  }
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
