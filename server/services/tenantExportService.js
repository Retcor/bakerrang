import archiver from 'archiver'
import { db } from '../client/firestoreClient.js'
import { gcsStorage } from '../client/gcsClient.js'

let firestore = db
let objectStorage = gcsStorage
export const _setDb = (value) => { firestore = value || db }
export const _setStorage = (value) => { objectStorage = value || gcsStorage }
const error = (status, message) => Object.assign(new Error(message), { status })
const doc = (snapshot) => ({ id: snapshot.id, ...snapshot.data() })
const read = async (collection) => (await collection.get()).docs.map(doc)
const json = (value) => JSON.stringify(value, null, 2)
const extension = (type) => type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'
const archiveName = (id, type, index) => `media/${String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || `media-${index}`}.${extension(type)}`

export const assertTenantExistsForExport = async (tenantId) => {
  const snapshot = await firestore.collection('tenants').doc(tenantId).get()
  if (!snapshot.exists) throw error(404, 'Tenant not found')
  return snapshot
}

export const streamTenantExport = async (tenantId, output) => {
  const tenantRef = firestore.collection('tenants').doc(tenantId)
  const tenantSnapshot = await assertTenantExistsForExport(tenantId)
  const [members, media, leads, audits, configSnapshot, publishedSnapshot, revisionIndexSnapshot, pointerSnapshot] = await Promise.all([
    read(tenantRef.collection('members')), read(tenantRef.collection('media')), read(tenantRef.collection('leads')), read(tenantRef.collection('auditEvents')),
    tenantRef.collection('site').doc('config').get(), tenantRef.collection('site').doc('config').collection('published').doc('current').get(), tenantRef.collection('site').doc('config').collection('revisionIndex').doc('current').get(), firestore.collection('tenantSiteDomains').doc(tenantId).get()
  ])
  const config = configSnapshot.exists ? configSnapshot.data() : null
  const pages = config ? await read(tenantRef.collection('site').doc('config').collection('pages')) : []
  const revisionIds = Array.isArray(revisionIndexSnapshot.data()?.entries) ? revisionIndexSnapshot.data().entries.map((entry) => entry.revisionId).filter(Boolean) : []
  const revisions = await Promise.all(revisionIds.map(async (id) => { const snap = await tenantRef.collection('site').doc('config').collection('revisions').doc(id).get(); return snap.exists ? doc(snap) : null }))
  const revisionMedia = await Promise.all(revisionIds.map(async (id) => { const snap = await tenantRef.collection('site').doc('config').collection('revisionMedia').doc(id).get(); return snap.exists ? doc(snap) : null }))
  const leadRows = await Promise.all(leads.map(async (lead) => ({ ...lead, notes: await read(tenantRef.collection('leads').doc(lead.id).collection('notes')) })))
  let domain = null
  if (pointerSnapshot.exists) {
    const hostname = pointerSnapshot.data()?.hostname
    if (typeof hostname === 'string') { const snap = await firestore.collection('siteDomains').doc(hostname).get(); if (snap.exists && snap.data()?.tenantId === tenantId) domain = { hostname, status: snap.data().status || null } }
  }
  const mediaManifest = media.map((item, index) => ({ mediaId: item.id, originalFilename: item.originalFilename, contentType: item.contentType, sizeBytes: item.sizeBytes, width: item.width, height: item.height, archivePath: archiveName(item.id, item.contentType, index) }))
  const manifest = { schemaVersion: 1, tenantId, tenantName: tenantSnapshot.data().name, exportedAt: Date.now(), counts: { members: members.length, media: media.length, leads: leads.length, auditEvents: audits.length, pages: pages.length, revisions: revisions.filter(Boolean).length }, consistency: 'Best-effort export; concurrent changes may or may not be reflected.' }
  const archive = archiver('zip', { zlib: { level: 9 } })
  const sources = new Set()
  const abort = (streamError) => {
    for (const source of sources) source.destroy(streamError)
    archive.abort()
    output.destroy(streamError)
  }
  const done = new Promise((resolve, reject) => { archive.on('error', reject); output.on('error', reject); output.on('close', resolve) })
  archive.pipe(output)
  archive.append(json(manifest), { name: 'manifest.json' })
  const tenant = tenantSnapshot.data()
  archive.append(json({ tenant: { id: tenantSnapshot.id, name: tenant.name, status: tenant.status, createdAt: tenant.createdAt, updatedAt: tenant.updatedAt, createdByUserId: tenant.createdByUserId }, members, domain }), { name: 'tenant.json' })
  archive.append(json({ config, pages, published: publishedSnapshot.exists ? publishedSnapshot.data() : null, revisions: revisions.filter(Boolean), revisionIndex: revisionIndexSnapshot.exists ? revisionIndexSnapshot.data() : null, revisionMedia: revisionMedia.filter(Boolean), leadNotifications: config?.leadNotifications || null }), { name: 'site.json' })
  archive.append(json(leadRows), { name: 'leads.json' }); archive.append(json(audits), { name: 'audit-events.json' }); archive.append(json(mediaManifest), { name: 'media-manifest.json' })
  for (let index = 0; index < media.length; index++) {
    const source = objectStorage.createReadStream(media[index].objectName)
    sources.add(source)
    source.once('error', abort)
    source.once('close', () => sources.delete(source))
    archive.append(source, { name: mediaManifest[index].archivePath })
  }
  // Completion is observed through the destination stream. Keeping this
  // rejection handled prevents an archiver abort from becoming unhandled.
  archive.finalize().catch(() => {})
  return done
}
