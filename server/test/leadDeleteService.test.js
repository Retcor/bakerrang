import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  deleteTenantLead
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
  _setDb(fakeDb)
})

afterEach(() => _setDb())

test('deleteTenantLead removes a NEW lead with no notes', async () => {
  fakeDb.seed(leadPath(), validLead())
  await deleteTenantLead('tenant-1', 'lead-1')
  assert.equal(fakeDb.data(leadPath()), undefined)
  assert.equal(fakeDb.paths().some((path) => path.includes('/leads/')), false)
})

test('deleteTenantLead removes every note beyond the UI cap plus the lead', async () => {
  fakeDb.seed(leadPath(), validLead())
  for (let index = 1; index <= 51; index += 1) {
    fakeDb.seed(notePath(`note-${index}`), validNote({ text: `Note ${index}`, createdAt: index }))
  }
  fakeDb.seed(leadPath('lead-2'), validLead())
  fakeDb.seed(notePath('other', 'lead-2'), validNote())

  await deleteTenantLead('tenant-1', 'lead-1')

  assert.equal(fakeDb.data(leadPath()), undefined)
  assert.equal(fakeDb.paths().some((path) => path.startsWith(`${leadPath()}/notes/`)), false)
  assert.deepEqual(fakeDb.data(leadPath('lead-2')), validLead())
  assert.deepEqual(fakeDb.data(notePath('other', 'lead-2')), validNote())
})

test('deleteTenantLead 404s an unknown id without writing', async () => {
  const before = fakeDb.paths().sort()
  await assert.rejects(deleteTenantLead('tenant-1', 'missing'), {
    status: 404, message: 'Lead not found'
  })
  assert.deepEqual(fakeDb.paths().sort(), before)
})
