import { FieldValue } from '@google-cloud/firestore'
import { db } from '../client/firestoreClient.js'
import { embedText } from './chatbotService.js'

const COLLECTION = 'wow_character_chunks'

// Safe character limit per chunk — keeps well under the 8192-token embedding limit.
// At ~4 chars/token, 20000 chars ≈ 5000 tokens, leaving comfortable headroom.
const MAX_CHUNK_CHARS = 20000

export function makeCharKey (region, realm, name) {
  const slug = realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')
  return `${region.toLowerCase()}_${slug}_${name.toLowerCase()}`
}

/**
 * Split a large list into multiple chunks that each fit within MAX_CHUNK_CHARS.
 * Returns an array of strings. If everything fits in one chunk, returns a 1-element array.
 *
 * @param {string} header  - Label line repeated at the top of every sub-chunk, e.g.
 *                           "Achievements Completed (500 total) — part 1:"
 * @param {string[]} lines - The individual item lines to distribute
 * @param {number} total   - Total count for the header label
 * @param {string} label   - Human-readable name used in the "part N of M" header
 */
export function splitLargeList (label, lines, total) {
  if (!lines.length) return []

  const parts = []
  let current = []
  let currentLen = 0

  for (const line of lines) {
    // +1 for the newline
    if (currentLen + line.length + 1 > MAX_CHUNK_CHARS && current.length > 0) {
      parts.push(current)
      current = []
      currentLen = 0
    }
    current.push(line)
    currentLen += line.length + 1
  }
  if (current.length > 0) parts.push(current)

  return parts.map((group, i) => {
    const header = parts.length > 1
      ? `${label} (${total} total — part ${i + 1} of ${parts.length}):`
      : `${label} (${total} total):`
    return header + '\n' + group.join('\n')
  })
}

function buildChunks (characterData, addonData, blizzardData) {
  const {
    name, realm, region, level, class: cls, race, spec,
    equippedIlvl, avgIlvl, mPlusScore, slots = [], weakSlots = [],
    recentRuns = [], raidProgress = []
  } = characterData

  // chunks maps chunkType → string | string[]
  // String[] means the list was too large and was split into sub-chunks.
  const chunks = {}

  // identity
  chunks.identity = `Character: ${name} on ${realm}-${region.toUpperCase()}
Race/Class/Spec: ${race} ${cls} — ${spec}
Level: ${level} | Equipped iLvl: ${equippedIlvl} | Avg iLvl: ${avgIlvl}
Mythic+ Score (current season): ${mPlusScore}`

  // gear
  const slotLines = slots.map(s => `  ${(s.label || s.slot).padEnd(12)} ${s.ilvl}  ${s.name}`).join('\n')
  const weakLines = weakSlots.length
    ? weakSlots.map(s => `  ${s.label}: ${s.ilvl} ilvl (${equippedIlvl - s.ilvl} below avg)`).join('\n')
    : '  None'
  chunks.gear = `Gear (item level by slot):\n${slotLines}\n\nWeak slots (10+ ilvl below avg):\n${weakLines}`

  // progression
  const runLines = recentRuns.length
    ? recentRuns.map(r => `  +${r.keystoneLevel} ${r.dungeon}`).join('\n')
    : '  None'
  const raidLines = raidProgress.length
    ? raidProgress.map(r => `  ${r.raid}: ${r.summary}`).join('\n')
    : '  None'
  chunks.progression = `Recent Mythic+ Runs:\n${runLines}\n\nRaid Progress:\n${raidLines}`

  // addon-sourced chunks
  if (addonData) {
    if (addonData.currencies?.length) {
      chunks.currencies = 'Currencies:\n' +
        addonData.currencies.map(c => `  ${c.name}: ${c.amount}`).join('\n')
    }

    if (addonData.vault?.length) {
      chunks.vault = 'Great Vault (weekly rewards):\n' +
        addonData.vault.map(v =>
          `  ${v.type}: ${v.progress}/${v.threshold} — ${v.rewardIlvl ? v.rewardIlvl + ' ilvl available' : 'locked'}`
        ).join('\n')
    }

    if (addonData.affixes?.length) {
      chunks.affixes = 'Current Mythic+ Affixes:\n' +
        addonData.affixes.map(a => `  ${a.name}${a.description ? ': ' + a.description : ''}`).join('\n')
    }

    const hasAddonAchievements = addonData.achievements?.length > 0
    const hasMountCount = addonData.mountCount != null
    if (hasAddonAchievements || hasMountCount) {
      const parts = []
      if (hasAddonAchievements) {
        parts.push('Recent/Notable Achievements:\n' +
          addonData.achievements.map(a => `  [${a.category}] ${a.name}`).join('\n'))
      }
      if (hasMountCount) {
        parts.push(`Mounts collected: ${addonData.mountCount.collected} / ${addonData.mountCount.total}`)
      }
      chunks.addonAchievements = parts.join('\n\n')
    }

    if (addonData.stats) {
      const s = addonData.stats
      chunks.stats = `Secondary Stats:\n  Haste: ${s.haste}%  Crit: ${s.crit}%  Mastery: ${s.mastery}%  Versatility: ${s.versatility}%`
    }

    if (addonData.worldQuests?.length) {
      chunks.worldQuests = 'Active World Quests:\n' +
        addonData.worldQuests.map(q => `  - ${q.name}`).join('\n')
    }

    if (addonData.inventory?.length) {
      const lines = addonData.inventory.map(i => {
        const count = i.count > 1 ? ` x${i.count}` : ''
        const ilvl = i.ilvl > 0 ? ` (ilvl ${i.ilvl})` : ''
        const type = i.type ? ` — ${i.type}${i.subtype ? '/' + i.subtype : ''}` : ''
        return `  [${i.quality}] ${i.name}${count}${ilvl}${type}`
      })
      chunks.inventory = splitLargeList('Bag Inventory (grey excluded)', lines, addonData.inventory.length)
    }

    if (addonData.bank?.length) {
      const lines = addonData.bank.map(i => {
        const count = i.count > 1 ? ` x${i.count}` : ''
        const ilvl = i.ilvl > 0 ? ` (ilvl ${i.ilvl})` : ''
        const type = i.type ? ` — ${i.type}${i.subtype ? '/' + i.subtype : ''}` : ''
        return `  [${i.quality}] ${i.name}${count}${ilvl}${type}`
      })
      chunks.bank = splitLargeList('Bank Contents (grey excluded)', lines, addonData.bank.length)
    }
  }

  // Blizzard API enrichment chunks — character-specific only.
  // Global game data (all achievements, expansion info) lives in wow_game_data
  // and is searched separately so it is shared across all users.
  if (blizzardData) {
    const { completedAchievements, collectedMounts } = blizzardData

    if (completedAchievements?.length) {
      const lines = completedAchievements.filter(a => a.name).map(a => `  - ${a.name}`)
      chunks.completedAchievements = splitLargeList(
        'Achievements Completed by this Character', lines, lines.length
      )
    }

    if (collectedMounts?.length) {
      const lines = collectedMounts.map(m => `  - ${m}`)
      chunks.collectedMounts = splitLargeList(
        'Mounts Collected by this Character', lines, collectedMounts.length
      )
    }

    if (blizzardData.reputations?.length) {
      const lines = blizzardData.reputations.map(r => {
        const progress = r.max > 0 ? ` (${r.value}/${r.max})` : ''
        const renown = r.renown ? ` [Renown ${r.renown.value}/${r.renown.cap}]` : ''
        return `  - ${r.faction}: ${r.standing}${progress}${renown}`
      })
      chunks.reputations = splitLargeList(
        'Reputation Standings for this Character', lines, lines.length
      )
    }

    if (blizzardData.mythicKeystoneProfile) {
      const mkp = blizzardData.mythicKeystoneProfile
      const scoreLines = mkp.seasonScores.map(s => `  Season score: ${s.score}`)
      const runLines = mkp.bestRuns.map(r => {
        const mins = Math.floor(r.duration / 60000)
        const secs = String(Math.round((r.duration % 60000) / 1000)).padStart(2, '0')
        const timed = r.isTimedRun ? ' ✓' : ' (depleted)'
        return `  +${r.keystoneLevel} ${r.dungeon} — ${mins}:${secs}${timed}`
      })
      chunks.mythicKeystoneProfile = 'Mythic+ Keystone Profile:\n' +
        [...scoreLines, '', 'Best runs this season:', ...runLines].join('\n')
    }

    if (blizzardData.professions) {
      const { primaries = [], secondaries = [] } = blizzardData.professions
      const lines = []
      if (primaries.length) {
        lines.push('Primary Professions:')
        for (const p of primaries) {
          lines.push(`  ${p.name}: ${p.skillPoints}/${p.maxSkillPoints}`)
          for (const t of p.tiers) {
            if (t.name) lines.push(`    [${t.name}] ${t.skillPoints}/${t.maxSkillPoints}`)
          }
        }
      }
      if (secondaries.length) {
        lines.push('Secondary Professions:')
        for (const p of secondaries) {
          lines.push(`  ${p.name}: ${p.skillPoints}/${p.maxSkillPoints}`)
        }
      }
      if (lines.length) chunks.professions = lines.join('\n')
    }

    if (blizzardData.talents) {
      const t = blizzardData.talents
      const talentLines = t.talents.map(tal => `  - ${tal.name}${tal.rank > 1 ? ' (rank ' + tal.rank + ')' : ''}`)
      const pvpLines = t.pvpTalents.map(name => `  - ${name}`)
      let content = `Active Talent Build — ${t.spec}:\n`
      if (talentLines.length) content += 'Talents:\n' + talentLines.join('\n')
      if (pvpLines.length) content += '\nPvP Talents:\n' + pvpLines.join('\n')
      chunks.talents = content
    }

    if (blizzardData.pvpSummary) {
      const pvp = blizzardData.pvpSummary
      const bracketLines = pvp.brackets
        .filter(b => b.rating > 0)
        .map(b => `  ${b.bracket}: ${b.rating} rating (${b.seasonWon}W/${b.seasonPlayed - b.seasonWon}L this season)`)
      chunks.pvpSummary = `PvP Summary:\n  Honor Level: ${pvp.honorLevel}\n  Honorable Kills: ${pvp.honorableKills}` +
        (bracketLines.length ? '\n' + bracketLines.join('\n') : '')
    }

    if (blizzardData.collectedPets?.length) {
      const lines = blizzardData.collectedPets.map(p => `  - ${p}`)
      chunks.collectedPets = splitLargeList(
        'Battle Pets Collected by this Character', lines, lines.length
      )
    }

    if (blizzardData.collectedToys?.length) {
      const lines = blizzardData.collectedToys.map(t => `  - ${t}`)
      chunks.collectedToys = splitLargeList(
        'Toys Collected by this Character', lines, lines.length
      )
    }

    if (blizzardData.earnedTitles?.length) {
      const lines = blizzardData.earnedTitles.map(t => `  - ${t}`)
      chunks.earnedTitles = splitLargeList(
        'Titles Earned by this Character', lines, lines.length
      )
    }

    if (blizzardData.statistics) {
      const s = blizzardData.statistics
      chunks.statistics = `Character Statistics:
  Health: ${s.health.toLocaleString()} | ${s.powerType}: ${s.power.toLocaleString()}
  Strength: ${s.strength} | Agility: ${s.agility} | Intellect: ${s.intellect} | Stamina: ${s.stamina}
  Armor: ${s.armor}
  Crit: ${s.critChance}% | Haste: ${s.hasteValue}% (${s.hasteRating} rating) | Mastery: ${s.masteryValue}%
  Versatility: ${s.versatilityDmg}% dmg / ${s.versatilityHeal}% heal / ${s.versatilityMitigation}% mitigation`
    }
  }

  return chunks
}

export async function buildAndStoreCharacterChunks (userId, characterData, addonData, blizzardData = null) {
  const charKey = makeCharKey(characterData.region, characterData.realm, characterData.name)

  // Delete all existing chunks for this character before writing fresh ones.
  // This prevents stale sub-chunks (e.g. old _1, _2 pages) from lingering after an update.
  const existing = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .where('charKey', '==', charKey)
    .get()
  await Promise.all(existing.docs.map(doc => doc.ref.delete()))

  const chunks = buildChunks(characterData, addonData, blizzardData)

  // Flatten: string values → single doc, string[] values → one doc per element
  const entries = []
  for (const [chunkType, value] of Object.entries(chunks)) {
    if (Array.isArray(value)) {
      value.forEach((content, i) => entries.push([`${chunkType}_${i}`, chunkType, content]))
    } else {
      entries.push([chunkType, chunkType, value])
    }
  }

  const writes = entries.map(async ([docSuffix, chunkType, content]) => {
    const docId = `${userId}_${charKey}_${docSuffix}`
    const embedding = await embedText(content)
    await db.collection(COLLECTION).doc(docId).set({
      content,
      embedding: FieldValue.vector(embedding),
      userId,
      charKey,
      chunkType,
      updatedAt: new Date().toISOString()
    })
  })

  await Promise.all(writes)
  return charKey
}

export async function searchCharacterChunks (question, userId, charKey, limit = 3) {
  const queryEmbedding = await embedText(question)
  const vectorQuery = db.collection(COLLECTION)
    .where('userId', '==', userId)
    .where('charKey', '==', charKey)
    .findNearest('embedding', FieldValue.vector(queryEmbedding), {
      limit,
      distanceMeasure: 'COSINE'
    })
  const snapshot = await vectorQuery.get()
  return snapshot.docs.map(doc => doc.data().content)
}

export async function getCharacterSavedMeta (userId, charKey) {
  const docId = `${userId}_${charKey}_identity`
  const doc = await db.collection(COLLECTION).doc(docId).get()
  if (!doc.exists) return null
  return { updatedAt: doc.data().updatedAt, charKey }
}
