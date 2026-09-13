import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable, Writable } from 'node:stream'
import { inflateRawSync } from 'node:zlib'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'
import { _setDb, _setStorage, streamTenantExport } from '../services/tenantExportService.js'

const zipEntries = (bytes) => {
  const entries = new Map()
  for (let offset = 0; offset < bytes.length - 46; offset++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) continue
    const method = bytes.readUInt16LE(offset + 10); const compressed = bytes.readUInt32LE(offset + 20)
    const nameLength = bytes.readUInt16LE(offset + 28); const local = bytes.readUInt32LE(offset + 42)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString()
    const localNameLength = bytes.readUInt16LE(local + 26); const localExtraLength = bytes.readUInt16LE(local + 28)
    const body = bytes.subarray(local + 30 + localNameLength + localExtraLength, local + 30 + localNameLength + localExtraLength + compressed)
    entries.set(name, method === 8 ? inflateRawSync(body) : body)
  }
  return entries
}

const exportZip = async (tenantId, database, storage) => {
  const chunks = []
  const sink = new Writable({ write (chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } })
  _setDb(database); _setStorage(storage)
  await streamTenantExport(tenantId, sink)
  return zipEntries(Buffer.concat(chunks))
}

test('tenant export includes complete tenant-owned JSON and streamed media only', async () => {
  const db = new FakeDb()
    .seed('tenants/a', { name: 'Tenant A', status: 'ACTIVE', createdAt: 1, providerSecret: 'SECRET-A' })
    .seed('tenants/a/members/member', { userId: 'member', role: 'ADMIN' })
    .seed('tenants/a/site/config', { status: 'PUBLISHED', leadNotifications: { enabled: true, recipients: ['owner@a.test'] } })
    .seed('tenants/a/site/config/pages/home', { id: 'home', title: 'Home' })
    .seed('tenants/a/site/config/published/current', { revisionId: 'r1', siteDefinition: { pages: [] } })
    .seed('tenants/a/site/config/revisionIndex/current', { entries: [{ revisionId: 'r1' }] })
    .seed('tenants/a/site/config/revisions/r1', { revisionId: 'r1' })
    .seed('tenants/a/site/config/revisionMedia/r1', { revisionId: 'r1', mediaIds: ['media-a'] })
    .seed('tenants/a/leads/lead-a', { name: 'Lead A', message: 'customer content' })
    .seed('tenants/a/leads/lead-a/notes/note-a', { text: 'note content' })
    .seed('tenants/a/auditEvents/e1', { eventId: 'e1', action: 'page.create' })
    .seed('tenants/a/auditEvents/e2', { eventId: 'e2', action: 'site.publish' })
    .seed('tenants/a/media/media-a', { originalFilename: '../secret.txt', objectName: 'tenants/a/media/media-a', contentType: 'image/png', sizeBytes: 3, width: 1, height: 1 })
    .seed('tenants/b', { name: 'Tenant B', providerSecret: 'SECRET-B' })
    .seed('tenants/b/auditEvents/b', { eventId: 'b', action: 'bad' })
    .seed('users/user', { email: 'legacy@user.test' }).seed('vaults/vault', { ciphertext: 'legacy-vault' })
    .seed('leadNotifications/outbox', { message: 'global-outbox' }).seed('runtimeConfig/provider', { secret: 'SITE-SECRET' })
    .seed('tenantSiteDomains/a', { hostname: 'a.test' }).seed('siteDomains/a.test', { tenantId: 'a', status: 'ACTIVE', verificationToken: 'TXT-SECRET' })
  const storage = new FakeStorage(); storage.objects.set('tenants/a/media/media-a', Buffer.from('abc'))
  try {
    const entries = await exportZip('a', db, storage)
    for (const name of ['manifest.json', 'tenant.json', 'site.json', 'leads.json', 'audit-events.json', 'media-manifest.json', 'media/media-a.png']) assert.ok(entries.has(name))
    const manifest = JSON.parse(entries.get('manifest.json')); assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.tenantId, 'a'); assert.equal(manifest.tenantName, 'Tenant A'); assert.ok(manifest.exportedAt); assert.equal(manifest.counts.auditEvents, 2); assert.match(manifest.consistency, /Best-effort/)
    const tenant = JSON.parse(entries.get('tenant.json')); assert.equal(tenant.members[0].role, 'ADMIN'); assert.deepEqual(tenant.domain, { hostname: 'a.test', status: 'ACTIVE' }); assert.equal(JSON.stringify(tenant).includes('TXT-SECRET'), false)
    const site = JSON.parse(entries.get('site.json')); assert.ok(site.config); assert.equal(site.pages[0].id, 'home'); assert.ok(site.published); assert.equal(site.revisions[0].revisionId, 'r1'); assert.ok(site.revisionIndex); assert.equal(site.revisionMedia[0].revisionId, 'r1'); assert.equal(site.leadNotifications.recipients[0], 'owner@a.test')
    assert.equal(JSON.parse(entries.get('leads.json'))[0].notes[0].text, 'note content'); assert.equal(JSON.parse(entries.get('audit-events.json')).length, 2)
    assert.equal(JSON.parse(entries.get('media-manifest.json'))[0].archivePath, 'media/media-a.png'); assert.equal(entries.get('media/media-a.png').toString(), 'abc')
    const all = Buffer.concat([...entries.values()]).toString(); for (const value of ['Tenant B', 'SECRET-B', 'legacy@user.test', 'legacy-vault', 'global-outbox', 'TXT-SECRET', 'SECRET-A']) assert.equal(all.includes(value), false)
  } finally { _setDb(); _setStorage() }
})

test('missing tenant media fails the streaming export instead of omitting it', async () => {
  const db = new FakeDb().seed('tenants/a', { name: 'A' }).seed('tenants/a/media/m', { originalFilename: 'm.png', objectName: 'tenants/a/media/m', contentType: 'image/png', sizeBytes: 1 })
  try { await assert.rejects(exportZip('a', db, new FakeStorage()), /Object not found/) } finally { _setDb(); _setStorage() }
})

test('an asynchronous media source error aborts an in-progress ZIP without an unhandled error', async () => {
  const db = new FakeDb().seed('tenants/a', { name: 'A' }).seed('tenants/a/media/m', { originalFilename: 'm.png', objectName: 'tenants/a/media/m', contentType: 'image/png', sizeBytes: 1 })
  const storage = { createReadStream: () => new Readable({ read () { this.push(Buffer.from('partial')); setImmediate(() => this.destroy(new Error('asynchronous media failure'))) } }) }
  const chunks = []; const sink = new Writable({ write (chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback() } })
  try {
    _setDb(db); _setStorage(storage)
    await assert.rejects(streamTenantExport('a', sink), /asynchronous media failure/)
    assert.equal(sink.destroyed, true)
    assert.equal(Buffer.concat(chunks).includes(Buffer.from('Tenant export failed')), false)
  } finally { _setDb(); _setStorage() }
})

test('missing tenant export fails before any archive stream is created', async () => {
  try { _setDb(new FakeDb()); await assert.rejects(streamTenantExport('missing-tenant', new Writable({ write (chunk, encoding, callback) { callback() } })), { status: 404 }) } finally { _setDb(); _setStorage() }
})
