import assert from 'node:assert/strict'
import test from 'node:test'
import { FakeDb } from './helpers/fakeDb.js'
import { listAuditEvents, writeAuditEvent } from '../services/auditService.js'
import * as sites from '../services/siteService.js'
import * as tenants from '../services/tenantService.js'
import * as media from '../services/mediaService.js'
import * as leads from '../services/leadService.js'
import * as notifications from '../services/leadNotificationSettingsService.js'
import { FakeStorage } from './helpers/fakeStorage.js'

const actor = { id: 'operator-1', email: 'operator@example.test', name: 'Operator One' }

test('audit events have an actor snapshot and commit only with their transaction', async () => {
  const database = new FakeDb()
  await database.runTransaction(async (transaction) => {
    writeAuditEvent({ firestore: database, transaction, tenantId: 'tenant-a', actor, action: 'page.create', entityType: 'page', entityId: 'page-a', summary: 'Created page', metadata: { pageId: 'page-a', pageTitle: 'About', pageSlug: '/about' } })
  })
  const [event] = (await listAuditEvents('tenant-a', {}, database)).events
  assert.deepEqual(event, {
    id: event.id,
    eventId: event.id,
    tenantId: 'tenant-a',
    occurredAt: event.occurredAt,
    actorUserId: 'operator-1',
    actorEmail: 'operator@example.test',
    actorName: 'Operator One',
    actorType: 'USER',
    action: 'page.create',
    entityType: 'page',
    entityId: 'page-a',
    summary: 'Created page',
    metadata: { pageId: 'page-a', pageTitle: 'About', pageSlug: '/about' }
  })
  assert.deepEqual((await listAuditEvents('tenant-b', {}, database)).events, [])
})

test('audit pagination uses occurredAt and eventId without loss at identical timestamps', async () => {
  const database = new FakeDb()
  for (const id of ['event-c', 'event-b', 'event-a']) {
    database.seed(`tenants/tenant-a/auditEvents/${id}`, { eventId: id, occurredAt: 10, tenantId: 'tenant-a' })
  }
  database.seed('tenants/tenant-a/auditEvents/event-old', { eventId: 'event-old', occurredAt: 9, tenantId: 'tenant-a' })
  const first = await listAuditEvents('tenant-a', { limit: 2 }, database)
  const second = await listAuditEvents('tenant-a', { limit: 2, cursor: first.nextCursor }, database)
  assert.deepEqual(first.events.map((event) => event.id), ['event-c', 'event-b'])
  assert.deepEqual(second.events.map((event) => event.id), ['event-a', 'event-old'])
  await assert.rejects(listAuditEvents('tenant-a', { limit: 0 }, database), { status: 400 })
  const capped = await listAuditEvents('tenant-a', { limit: 999 }, database)
  assert.equal(capped.events.length, 4)
})

test('an audited page mutation retries to one committed event', async () => {
  const database = new FakeDb().seed('tenants/tenant-a', { name: 'Tenant A' })
  sites._setDb(database)
  try {
    await sites.initializeSite('tenant-a', 'operator-1')
    let conflicted = false
    database.beforeCommit = async ({ writes }) => {
      if (!conflicted && writes.some((write) => write.ref.path === 'tenants/tenant-a/site/config')) {
        conflicted = true
        database.write('tenants/tenant-a/site/config', { touchedByConflict: true }, { merge: true })
      }
    }
    const created = await sites.createPage('tenant-a', { title: 'Page A', slug: 'page-a' }, actor)
    assert.ok(created.pageId)
    const events = (await listAuditEvents('tenant-a', {}, database)).events.filter((event) => event.action === 'page.create')
    assert.equal(events.length, 1)
    assert.equal(database.transactionAttempts >= 3, true)
  } finally {
    sites._setDb(null)
  }
})

const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030802000000', 'hex')
const eventsFor = async (database, tenantId) => (await listAuditEvents(tenantId, {}, database)).events

test('representative operator mutations emit one useful event with session actor metadata', async () => {
  const database = new FakeDb().seed('users/member-1', { email: 'member@example.test' })
  const storage = new FakeStorage()
  tenants._setDb(database); sites._setDb(database); media._setDb(database); media._setStorage(storage); leads._setDb(database); notifications._setDb(database)
  try {
    const tenant = await tenants.createTenant(actor.id, { name: 'Tenant A' }, actor)
    let events = await eventsFor(database, tenant.id)
    assert.equal(events.length, 1)
    assert.deepEqual(events[0].metadata, { tenantName: 'Tenant A' })
    assert.equal(events[0].action, 'tenant.create')
    assert.equal(events[0].actorEmail, actor.email)

    await tenants.addMember(tenant.id, { userId: 'member-1', role: 'STAFF' }, actor.id, actor)
    await sites.initializeSite(tenant.id, actor.id)
    await sites.publishSite(tenant.id, actor.id, actor)
    const uploaded = await media.createMedia(tenant.id, { mimetype: 'image/png', buffer: png, originalname: 'secret-name.png' }, actor.id, actor)
    await media.deleteUnusedMedia(tenant.id, uploaded.id, actor)
    database.seed(`tenants/${tenant.id}/leads/lead-1`, { name: 'Visitor', email: 'visitor@example.test', message: 'private lead message', status: 'NEW', source: 'WEBSITE', createdAt: 10, updatedAt: 10 })
    await leads.updateLeadStatus(tenant.id, 'lead-1', { status: 'CONTACTED', expectedUpdatedAt: 10 }, actor)
    await leads.createLeadNote(tenant.id, 'lead-1', { text: 'private note text' }, actor.id, actor)
    await notifications.updateLeadNotificationSettings(tenant.id, { enabled: true, recipients: ['private-recipient@example.test'] }, actor)

    events = await eventsFor(database, tenant.id)
    const byAction = new Map(events.map((event) => [event.action, event]))
    assert.equal(byAction.get('member.add').entityType, 'member')
    assert.equal(byAction.get('site.publish').entityType, 'site')
    assert.equal(byAction.get('media.upload').metadata.originalFilename, 'secret-name.png')
    assert.equal(byAction.get('media.delete').entityId, uploaded.id)
    assert.deepEqual(byAction.get('lead.status.change').metadata, { leadId: 'lead-1', oldStatus: 'NEW', newStatus: 'CONTACTED' })
    assert.equal(byAction.get('lead.note.add').entityId, 'lead-1')
    assert.deepEqual(byAction.get('leadNotifications.update').metadata, { enabled: true, recipientCount: 1 })
    const serialized = JSON.stringify(events)
    assert.equal(serialized.includes('private lead message'), false)
    assert.equal(serialized.includes('private note text'), false)
    assert.equal(serialized.includes('private-recipient@example.test'), false)
  } finally {
    tenants._setDb(); sites._setDb(); media._setDb(); media._setStorage(); leads._setDb(); notifications._setDb()
  }
})

test('failed and audit-write-failed mutations leave no domain or audit data', async () => {
  const database = new FakeDb().seed('tenants/tenant-a', { name: 'Tenant A' })
  sites._setDb(database)
  try {
    await sites.initializeSite('tenant-a', actor.id)
    await assert.rejects(sites.createPage('tenant-a', { title: '', slug: 'bad' }, actor), { status: 400 })
    assert.deepEqual(await eventsFor(database, 'tenant-a'), [])
    const before = database.data('tenants/tenant-a/site/config')
    database.beforeTransactionSet = ({ ref }) => {
      if (ref.path.includes('/auditEvents/')) throw new Error('audit write failed')
    }
    await assert.rejects(sites.createPage('tenant-a', { title: 'Will roll back', slug: 'will-roll-back' }, actor), /audit write failed/)
    assert.deepEqual(database.data('tenants/tenant-a/site/config'), before)
    assert.deepEqual(await eventsFor(database, 'tenant-a'), [])
  } finally {
    sites._setDb()
  }
})
