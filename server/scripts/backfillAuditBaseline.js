// One-off maintenance: reset a vault's version history and seed an "initial"
// (baseline) snapshot for every entry and folder that currently exists, so that
// the NEXT edit has a version to diff against.
//
// The audit snapshot is just the ciphertext already stored on each item/folder,
// so this copies stored fields — it never decrypts anything and needs no keys.
// Runs with the same Firestore credentials the server uses (ADC), so run it from
// the `server/` directory on a machine/env where the app can reach Firestore.
//
// Usage:
//   node scripts/backfillAuditBaseline.js            # LIST vaults (read-only) so you can pick a userId
//   node scripts/backfillAuditBaseline.js <userId>   # reset + baseline ONE user's vault
//   node scripts/backfillAuditBaseline.js --all       # reset + baseline EVERY vault
//
// "Reset" means: DELETE all existing audit records for that vault first (clears
// your testing noise), then write one baseline record per current item/folder.
import { randomUUID } from 'crypto'
import { db } from '../client/firestoreClient.js'

const vaultRef = (userId) => db.collection('vaults').doc(userId)
const itemsRef = (userId) => vaultRef(userId).collection('items')
const foldersRef = (userId) => vaultRef(userId).collection('folders')
const auditRef = (userId) => vaultRef(userId).collection('audit')

const commitInChunks = async (ops) => {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch()
    ops.slice(i, i + 400).forEach((op) => op(batch))
    await batch.commit()
  }
}

const emailFor = async (userId) => {
  try {
    const doc = await db.collection('users').doc(userId).get()
    return doc.exists ? (doc.data().email || null) : null
  } catch (err) { return null }
}

const listVaults = async () => {
  const snap = await db.collection('vaults').get()
  console.log(`Found ${snap.size} vault(s):\n`)
  for (const d of snap.docs) {
    const [items, folders, email] = await Promise.all([
      itemsRef(d.id).get(),
      foldersRef(d.id).get(),
      emailFor(d.id)
    ])
    console.log(`  ${d.id}  —  ${email || '(no email)'}  —  ${items.size} entries, ${folders.size} folders`)
  }
  console.log('\nRe-run with a userId (or --all) to reset + baseline.')
}

const backfillOne = async (userId) => {
  const email = await emailFor(userId)
  const [items, folders, existingAudit] = await Promise.all([
    itemsRef(userId).get(),
    foldersRef(userId).get(),
    auditRef(userId).get()
  ])

  // 1) Clear existing audit records (testing noise).
  const deletes = existingAudit.docs.map((d) => (b) => b.delete(d.ref))
  await commitInChunks(deletes)

  // 2) Seed a baseline snapshot per current item + folder. Dated at the record's
  //    own createdAt so the baseline sorts as the OLDEST event — future edits
  //    appear above it and diff against it.
  const actor = { id: userId, email }
  const writes = []

  items.docs.forEach((d) => {
    const r = d.data()
    writes.push((b) => b.set(auditRef(userId).doc(randomUUID()), {
      action: 'item.baseline',
      targetType: 'item',
      targetId: d.id,
      folderId: r.folderId || null,
      snapshot: {
        wrappedItemKey: r.wrappedItemKey || null,
        ciphertext: r.ciphertext,
        folderWrappedItemKey: r.folderWrappedItemKey || null,
        folderId: r.folderId || null
      },
      meta: null,
      actorId: actor.id,
      actorEmail: actor.email,
      createdAt: r.createdAt || r.updatedAt || Date.now()
    }))
  })

  folders.docs.forEach((d) => {
    const r = d.data()
    if (!r.ciphertext) return // recipient-created folders have no owner-readable name; skip
    writes.push((b) => b.set(auditRef(userId).doc(randomUUID()), {
      action: 'folder.baseline',
      targetType: 'folder',
      targetId: d.id,
      folderId: d.id,
      snapshot: { ciphertext: r.ciphertext, sharedName: r.sharedName || null },
      meta: null,
      actorId: actor.id,
      actorEmail: actor.email,
      createdAt: r.createdAt || r.updatedAt || Date.now()
    }))
  })

  await commitInChunks(writes)
  console.log(`  ${userId} (${email || 'no email'}): cleared ${existingAudit.size} audit record(s), wrote ${items.size} entry + ${folders.docs.filter((d) => d.data().ciphertext).length} folder baseline(s).`)
}

const main = async () => {
  const arg = process.argv[2]
  if (!arg) {
    await listVaults()
    return
  }
  if (arg === '--all') {
    const snap = await db.collection('vaults').get()
    console.log(`Resetting + baselining ${snap.size} vault(s)…`)
    for (const d of snap.docs) await backfillOne(d.id)
  } else {
    console.log(`Resetting + baselining vault ${arg}…`)
    await backfillOne(arg)
  }
  console.log('Done.')
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
