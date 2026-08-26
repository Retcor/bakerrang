import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  createLeadNote,
  listLeadNotes,
  updateLeadStatus
} from '../services/leadService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb
const tenantPath = (tenantId = 'tenant-1') => `tenants/${tenantId}`
const leadPath = (leadId = 'lead-1', tenantId = 'tenant-1') =>
  `${tenantPath(tenantId)}/leads/${leadId}`
const notePath = (noteId, leadId = 'lead-1', tenantId = 'tenant-1') =>
  `${leadPath(leadId, tenantId)}/notes/${noteId}`
const validLead = (overrides = {}) => ({
  name: 'Visitor',
  message: 'Please contact me.',
  status: 'NEW',
  source: 'WEBSITE',
  createdAt: 10,
  updatedAt: 10,
  ...overrides
})
const validNote = (overrides = {}) => ({
  text: 'Called customer.',
  createdAt: 20,
  createdByUserId: 'staff',
  ...overrides
})

beforeEach(() => {
  fakeDb = new FakeDb()
  fakeDb.seed(tenantPath(), { name: 'Business' })
  fakeDb.seed(leadPath(), validLead())
  _setDb(fakeDb)
})

afterEach(() => _setDb())

test('createLeadNote trims text and owns id, timestamp, author, and stored shape', async (t) => {
  t.mock.method(Date, 'now', () => 1234)
  const leadBefore = fakeDb.data(leadPath())
  const created = await createLeadNote('tenant-1', 'lead-1', {
    text: '  Called customer, left voicemail.  ',
    id: 'client-note',
    createdAt: 1,
    createdByUserId: 'spoofed',
    tenantId: 'other',
    leadId: 'other',
    unknown: true
  }, 'staff')

  assert.match(created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.deepEqual(created, {
    id: created.id,
    text: 'Called customer, left voicemail.',
    createdAt: 1234,
    createdByUserId: 'staff'
  })
  assert.deepEqual(fakeDb.data(notePath(created.id)), {
    text: 'Called customer, left voicemail.',
    createdAt: 1234,
    createdByUserId: 'staff'
  })
  assert.deepEqual(fakeDb.data(leadPath()), leadBefore)
  assert.deepEqual(fakeDb.paths().sort(), [tenantPath(), leadPath(), notePath(created.id)].sort())
})

test('createLeadNote validates required and bounded text before writing', async () => {
  for (const text of [undefined, null, 1, '', '   ']) {
    await assert.rejects(createLeadNote('tenant-1', 'lead-1', { text }, 'staff'), {
      status: 400, message: 'Lead note is required'
    })
  }
  await assert.rejects(createLeadNote('tenant-1', 'lead-1', {
    text: 'x'.repeat(2001)
  }, 'staff'), {
    status: 400, message: 'Lead note must be 2000 characters or fewer'
  })
  assert.deepEqual(fakeDb.paths().sort(), [tenantPath(), leadPath()].sort())
})

test('createLeadNote requires both parent documents and never creates an orphan', async () => {
  await assert.rejects(createLeadNote('missing', 'lead-1', { text: 'Note' }, 'staff'), {
    status: 404, message: 'Tenant not found'
  })
  await assert.rejects(createLeadNote('tenant-1', 'missing', { text: 'Note' }, 'staff'), {
    status: 404, message: 'Lead not found'
  })
  assert.equal(fakeDb.paths().some((path) => path.includes('/notes/')), false)
})

test('Notes require parent existence but not a well-formed Lead', async () => {
  fakeDb.seed(leadPath(), { malformed: true })
  const created = await createLeadNote('tenant-1', 'lead-1', { text: 'Independent note' }, 'staff')
  assert.equal(created.text, 'Independent note')
  assert.deepEqual(await listLeadNotes('tenant-1', 'lead-1'), {
    notes: [created], hasMore: false
  })
  assert.deepEqual(fakeDb.data(leadPath()), { malformed: true })
})

test('listLeadNotes returns an empty bounded result for an existing Lead', async () => {
  assert.deepEqual(await listLeadNotes('tenant-1', 'lead-1'), {
    notes: [], hasMore: false
  })
})

test('listLeadNotes is Lead- and tenant-scoped, newest-first, and sanitized', async () => {
  fakeDb.seed(notePath('older'), validNote({ text: 'Older', createdAt: 20, unknown: 'drop' }))
  fakeDb.seed(notePath('newer'), validNote({ text: 'Newer', createdAt: 30, createdByUserId: 'admin' }))
  fakeDb.seed(leadPath('lead-2'), validLead())
  fakeDb.seed(notePath('other-lead', 'lead-2'), validNote({ createdAt: 40 }))
  fakeDb.seed(tenantPath('tenant-2'), { name: 'Other' })
  fakeDb.seed(leadPath('lead-1', 'tenant-2'), validLead())
  fakeDb.seed(notePath('other-tenant', 'lead-1', 'tenant-2'), validNote({ createdAt: 50 }))

  assert.deepEqual(await listLeadNotes('tenant-1', 'lead-1'), {
    notes: [
      { id: 'newer', text: 'Newer', createdAt: 30, createdByUserId: 'admin' },
      { id: 'older', text: 'Older', createdAt: 20, createdByUserId: 'staff' }
    ],
    hasMore: false
  })
})

test('listLeadNotes returns at most 50 candidates and reports a 51st', async () => {
  for (let index = 1; index <= 51; index += 1) {
    fakeDb.seed(notePath(`note-${index}`), validNote({ text: `Note ${index}`, createdAt: index }))
  }
  const result = await listLeadNotes('tenant-1', 'lead-1')
  assert.equal(result.notes.length, 50)
  assert.equal(result.hasMore, true)
  assert.equal(result.notes[0].id, 'note-51')
  assert.equal(result.notes.at(-1).id, 'note-2')
})

test('listLeadNotes returns exactly 50 without hasMore', async () => {
  for (let index = 1; index <= 50; index += 1) {
    fakeDb.seed(notePath(`note-${index}`), validNote({ createdAt: index }))
  }
  const result = await listLeadNotes('tenant-1', 'lead-1')
  assert.equal(result.notes.length, 50)
  assert.equal(result.hasMore, false)
})

test('listLeadNotes skips malformed Notes and validates server timestamps', async () => {
  const malformed = [
    { text: '' },
    { createdAt: -1 },
    { createdAt: 1.5 },
    { createdAt: '20' },
    { createdByUserId: '' }
  ]
  malformed.forEach((overrides, index) => {
    fakeDb.seed(notePath(`bad-${index}`), validNote({ createdAt: 100 + index, ...overrides }))
  })
  const missingTimestamp = validNote()
  delete missingTimestamp.createdAt
  fakeDb.seed(notePath('missing-created'), missingTimestamp)
  fakeDb.seed(notePath('valid'), validNote({ createdAt: 10 }))

  const result = await listLeadNotes('tenant-1', 'lead-1')
  assert.deepEqual(result, {
    notes: [{ id: 'valid', text: 'Called customer.', createdAt: 10, createdByUserId: 'staff' }],
    hasMore: false
  })
})

test('listLeadNotes distinguishes missing tenant and Lead', async () => {
  await assert.rejects(listLeadNotes('missing', 'lead-1'), {
    status: 404, message: 'Tenant not found'
  })
  await assert.rejects(listLeadNotes('tenant-1', 'missing'), {
    status: 404, message: 'Lead not found'
  })
})

test('creating a Note does not invalidate Lead status concurrency', async (t) => {
  t.mock.method(Date, 'now', () => 100)
  const original = fakeDb.data(leadPath())
  await createLeadNote('tenant-1', 'lead-1', { text: 'Called customer.' }, 'staff')
  assert.deepEqual(fakeDb.data(leadPath()), original)

  const updated = await updateLeadStatus('tenant-1', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: original.updatedAt
  })
  assert.equal(updated.status, 'CONTACTED')
  assert.equal(updated.updatedAt, 100)
})
