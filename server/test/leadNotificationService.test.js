import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setClock,
  _setDb,
  _setSender,
  drainLeadNotifications,
  notificationConstants,
  pendingLeadNotification,
  processLeadNotification
} from '../services/leadNotificationService.js'
import { _setDb as setLeadDb, createPublicLead } from '../services/leadService.js'
import { _setDb as setSiteDb } from '../services/siteService.js'
import { createNotificationSender } from '../services/notificationSender.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb
let sent
const NOW = 1700000000000
const env = { NODE_ENV: 'test', PORTAL_DOMAIN: 'https://portal.example.test' }

const lead = (overrides = {}) => ({
  name: 'Jamie <Visitor>',
  email: 'jamie@example.test',
  phone: '801-555-0100',
  message: 'Hello <script>alert(1)</script>',
  ...overrides
})

const seedConfig = (config = {}) => {
  fakeDb.seed('tenants/tenant-1', { name: 'Acme\r\nBcc: attacker@example.test' })
  fakeDb.seed('tenants/tenant-1/site/config', {
    branding: { siteName: 'Acme <Co>' },
    ...config
  })
}

const seedOutbox = (id = 'lead-1', overrides = {}) => {
  fakeDb.seed(`leadNotifications/${id}`, {
    ...pendingLeadNotification({ tenantId: 'tenant-1', leadId: id, lead: lead(), now: NOW }),
    ...overrides
  })
}

beforeEach(() => {
  fakeDb = new FakeDb()
  sent = []
  _setDb(fakeDb)
  setLeadDb(fakeDb)
  setSiteDb(fakeDb)
  _setClock(() => NOW)
  _setSender(async (snapshot) => { sent.push(structuredClone(snapshot)) })
})

afterEach(() => {
  _setDb()
  setLeadDb()
  setSiteDb()
  _setClock()
  _setSender()
})

test('lead and outbox are atomically written, while a honeypot writes neither', async () => {
  const published = {
    status: 'PUBLISHED',
    pages: [{
      id: 'home',
      slug: '/',
      title: 'Home',
      sections: [
        { id: 'hero', type: 'hero', hidden: false, content: { title: 'Business' } },
        {
          id: 'contact',
          type: 'contact',
          hidden: false,
          content: { title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' } }
        }
      ]
    }]
  }
  fakeDb.seed('tenants/tenant-1/site/config', { status: 'PUBLISHED' })
  fakeDb.seed('tenants/tenant-1/site/config/published/current', { siteDefinition: published })
  await createPublicLead('tenant-1', { name: 'Jamie', email: 'jamie@example.test', message: 'Hi' })
  assert.equal(sent.length, 0, 'public lead creation must never invoke the sender')
  const leadPath = fakeDb.paths().find((path) => path.startsWith('tenants/tenant-1/leads/'))
  const leadId = leadPath.split('/').at(-1)
  assert.equal(fakeDb.data(`leadNotifications/${leadId}`).leadId, leadId)

  const before = fakeDb.paths().length
  await createPublicLead('tenant-1', { website: 'robot.example' })
  assert.equal(fakeDb.paths().length, before)

  fakeDb.beforeCommit = async () => { throw new Error('transaction aborted') }
  await assert.rejects(createPublicLead('tenant-1', { name: 'Nope', email: 'nope@example.test', message: 'Hi' }))
  assert.equal(fakeDb.paths().filter((path) => path.startsWith('leadNotifications/')).length, 1)
  assert.equal(fakeDb.paths().filter((path) => path.startsWith('tenants/tenant-1/leads/')).length, 1)
})

test('PENDING claim freezes a payload using explicit recipients before the profile fallback', async () => {
  seedConfig({
    businessProfile: { email: 'profile@example.test' },
    leadNotifications: { recipients: ['ops@example.test', 'OPS@example.test'] }
  })
  seedOutbox()
  assert.deepEqual(await processLeadNotification('lead-1', { now: NOW, env }), { claimed: true, sent: true })
  const outbox = fakeDb.data('leadNotifications/lead-1')
  assert.equal(outbox.status, 'SENT')
  assert.deepEqual(sent[0].recipients, ['ops@example.test'])
  assert.equal(sent[0].replyTo, 'jamie@example.test')
  assert.equal(sent[0].idempotencyKey, 'lead-notification/tenant-1/lead-1')
})

test('notification rendering escapes HTML user content and strips CR/LF from subject text', async () => {
  seedConfig({
    branding: { siteName: 'Acme\r\nBcc: attacker@example.test <Co>' },
    leadNotifications: { recipients: ['ops@example.test'] }
  })
  seedOutbox()
  await processLeadNotification('lead-1', { now: NOW, env })
  assert.match(sent[0].html, /&lt;script&gt;/)
  assert.doesNotMatch(sent[0].html, /<script>/)
  assert.doesNotMatch(sent[0].subject, /[\r\n]/)
  assert.equal(sent[0].subject, 'New website lead — Acme Bcc: attacker@example.test <Co>')
})

test('BusinessProfile fallback works and no recipient or disabled settings skip without sending', async () => {
  seedConfig({ businessProfile: { email: 'profile@example.test' } })
  seedOutbox('profile')
  await processLeadNotification('profile', { now: NOW, env })
  assert.deepEqual(sent[0].recipients, ['profile@example.test'])

  fakeDb = new FakeDb()
  _setDb(fakeDb)
  seedConfig({ leadNotifications: { enabled: false, recipients: ['ops@example.test'] } })
  seedOutbox('disabled')
  await processLeadNotification('disabled', { now: NOW, env })
  assert.equal(fakeDb.data('leadNotifications/disabled').skipReason, 'DISABLED')

  fakeDb = new FakeDb()
  _setDb(fakeDb)
  seedConfig()
  seedOutbox('empty')
  await processLeadNotification('empty', { now: NOW, env })
  assert.equal(fakeDb.data('leadNotifications/empty').skipReason, 'NO_RECIPIENT')
})

test('retries retain the frozen payload and stable idempotency key despite settings changes', async () => {
  seedConfig({ leadNotifications: { recipients: ['before@example.test'] } })
  seedOutbox()
  _setSender(async () => { throw new Error('temporary outage') })
  await processLeadNotification('lead-1', { now: NOW, env })
  const afterFailure = fakeDb.data('leadNotifications/lead-1')
  assert.equal(afterFailure.status, 'PENDING')
  assert.equal(afterFailure.nextAttemptAt, NOW + notificationConstants.RETRY_DELAYS[0])
  assert.equal(afterFailure.deliverySnapshot.recipients[0], 'before@example.test')

  fakeDb.write('tenants/tenant-1/site/config', { leadNotifications: { recipients: ['after@example.test'] } }, { merge: true })
  _setSender(async (snapshot) => { sent.push(snapshot) })
  await processLeadNotification('lead-1', { now: afterFailure.nextAttemptAt, env })
  assert.deepEqual(sent[0].recipients, ['before@example.test'])
  assert.equal(sent[0].idempotencyKey, 'lead-notification/tenant-1/lead-1')
})

test('expired PROCESSING leases recover, fifth failure becomes FAILED, and deleted leads remain deliverable', async () => {
  seedConfig({ leadNotifications: { recipients: ['ops@example.test'] } })
  seedOutbox('recovery', { status: 'PROCESSING', attempts: 1, leaseUntil: NOW - 1 })
  fakeDb.seed('tenants/tenant-1/leads/recovery', { name: 'A lead that was later deleted' })
  fakeDb.remove('tenants/tenant-1/leads/recovery')
  await drainLeadNotifications({ now: NOW, env })
  assert.equal(fakeDb.data('leadNotifications/recovery').status, 'SENT')

  seedOutbox('fifth', { attempts: 4 })
  _setSender(async () => { throw new Error('still down') })
  await processLeadNotification('fifth', { now: NOW, env })
  assert.equal(fakeDb.data('leadNotifications/fifth').status, 'FAILED')
})

test('a crash after provider acceptance reuses the existing frozen payload and key', async () => {
  seedConfig({ leadNotifications: { recipients: ['changed@example.test'] } })
  const frozen = {
    recipients: ['original@example.test'],
    subject: 'Original',
    text: 'Original text',
    html: '<p>Original</p>',
    idempotencyKey: 'lead-notification/tenant-1/crash'
  }
  seedOutbox('crash', {
    status: 'PROCESSING',
    attempts: 1,
    leaseUntil: NOW - 1,
    deliverySnapshot: frozen
  })
  await processLeadNotification('crash', { now: NOW, env })
  assert.deepEqual(sent[0], frozen)
  assert.equal(fakeDb.data('leadNotifications/crash').status, 'SENT')
})

test('overlapping claims serialize so only one sender call occurs', async () => {
  seedConfig({ leadNotifications: { recipients: ['ops@example.test'] } })
  seedOutbox()
  let releaseFirstCommit
  let enteredFirstCommit
  const firstCommit = new Promise((resolve) => { enteredFirstCommit = resolve })
  const release = new Promise((resolve) => { releaseFirstCommit = resolve })
  let holdFirstCommit = true
  fakeDb.beforeCommit = async () => {
    if (!holdFirstCommit) return
    holdFirstCommit = false
    enteredFirstCommit()
    await release
  }
  _setSender(async (snapshot) => { sent.push(snapshot) })
  const first = processLeadNotification('lead-1', { now: NOW, env })
  await firstCommit
  const second = await processLeadNotification('lead-1', { now: NOW, env })
  releaseFirstCommit()
  assert.deepEqual(await first, { claimed: false, sent: false })
  assert.deepEqual(second, { claimed: true, sent: true })
  assert.ok(fakeDb.transactionAttempts >= 4, 'the stale first claim must retry through FakeDb OCC')
  assert.equal(sent.length, 1)
})

test('Resend adapter reuses the frozen idempotency key and never accepts recipients from public input', async () => {
  const calls = []
  const resend = createNotificationSender({
    env: { NODE_ENV: 'production', RESEND_API_KEY: 'key', LEAD_NOTIFICATION_FROM: 'from@example.test' },
    client: { post: async (...args) => { calls.push(args); return { data: { id: 'mail-1' } } } }
  })
  await resend({ recipients: ['ops@example.test'], subject: 'Subject', text: 'Text', html: '<p>Text</p>', idempotencyKey: 'stable' })
  assert.deepEqual(calls[0][1].to, ['ops@example.test'])
  assert.equal(calls[0][2].headers['Idempotency-Key'], 'stable')
})
