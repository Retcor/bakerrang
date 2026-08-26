import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { LEAD_STATUSES, isLeadStatus } from '../domain/leadStatus.js'
import {
  _setDb,
  getTenantLead,
  listTenantLeads,
  updateLeadStatus
} from '../services/leadService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb
const tenantPath = 'tenants/tenant-1'
const leadPath = (id, tenantId = 'tenant-1') => `tenants/${tenantId}/leads/${id}`
const validLead = (overrides = {}) => ({
  name: 'Visitor',
  email: 'visitor@example.com',
  phone: '801-555-1234',
  message: 'Please contact me.',
  status: 'NEW',
  source: 'WEBSITE',
  createdAt: 10,
  updatedAt: 10,
  unknown: 'preserve',
  ...overrides
})

beforeEach(() => {
  fakeDb = new FakeDb()
  fakeDb.seed(tenantPath, { name: 'Business' })
  _setDb(fakeDb)
})

afterEach(() => _setDb())

test('LeadStatus recognizes exactly every supported server status', () => {
  assert.deepEqual(LEAD_STATUSES, ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'])
  for (const status of LEAD_STATUSES) assert.equal(isLeadStatus(status), true)
  for (const status of ['new', 'Contacted', 'UNKNOWN', '', null]) {
    assert.equal(isLeadStatus(status), false)
  }
})

test('updateLeadStatus rejects missing and unsupported statuses before a transaction', async () => {
  fakeDb.seed(leadPath('lead-1'), validLead())
  for (const status of [undefined, null, 1]) {
    await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
      status, expectedUpdatedAt: 10
    }), { status: 400, message: 'Lead status is required' })
  }
  for (const status of ['new', 'Contacted', 'UNKNOWN']) {
    await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
      status, expectedUpdatedAt: 10
    }), { status: 400, message: 'Lead status is not supported' })
  }
})

test('updateLeadStatus requires a non-negative safe-integer concurrency token', async () => {
  fakeDb.seed(leadPath('lead-1'), validLead())
  await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', { status: 'CONTACTED' }), {
    status: 400, message: 'expectedUpdatedAt is required'
  })
  for (const expectedUpdatedAt of ['10', null, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
      status: 'CONTACTED', expectedUpdatedAt
    }), { status: 400, message: 'expectedUpdatedAt must be a non-negative safe integer' })
  }
})

test('updateLeadStatus permits representative unrestricted transitions', async () => {
  const transitions = [
    ['NEW', 'CONTACTED'],
    ['CONTACTED', 'QUOTED'],
    ['QUOTED', 'WON'],
    ['WON', 'NEW'],
    ['LOST', 'CONTACTED']
  ]
  for (const [index, [from, to]] of transitions.entries()) {
    const id = `lead-${index}`
    fakeDb.seed(leadPath(id), validLead({ status: from, updatedAt: 20 + index }))
    const result = await updateLeadStatus('tenant-1', id, {
      status: to, expectedUpdatedAt: 20 + index, ignored: 'drop'
    })
    const stored = fakeDb.data(leadPath(id))
    assert.equal(result.status, to)
    assert.equal(stored.status, to)
    assert.equal(stored.createdAt, 10)
    assert.ok(stored.updatedAt > 20 + index)
    assert.equal(stored.ignored, undefined)
    assert.equal(stored.unknown, 'preserve')
    assert.equal(Object.hasOwn(result, 'unknown'), false)
  }
})

test('updateLeadStatus distinguishes missing tenant and lead inside the transaction', async () => {
  await assert.rejects(updateLeadStatus('missing', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: 10
  }), { status: 404, message: 'Tenant not found' })
  await assert.rejects(updateLeadStatus('tenant-1', 'missing', {
    status: 'CONTACTED', expectedUpdatedAt: 10
  }), { status: 404, message: 'Lead not found' })
})

test('updateLeadStatus rejects malformed stored leads without changing them', async () => {
  const malformed = validLead({ status: 'UNKNOWN' })
  fakeDb.seed(leadPath('lead-1'), malformed)
  await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: 10
  }), { status: 500, message: 'Lead data invalid' })
  assert.deepEqual(fakeDb.data(leadPath('lead-1')), malformed)
})

test('updateLeadStatus rejects stale writes and preserves the current lead', async () => {
  const original = validLead({ status: 'CONTACTED', updatedAt: 20 })
  fakeDb.seed(leadPath('lead-1'), original)
  await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
    status: 'QUOTED', expectedUpdatedAt: 19
  }), { status: 409, message: 'Lead has changed. Refresh and try again.' })
  assert.deepEqual(fakeDb.data(leadPath('lead-1')), original)
})

test('same-status update with a current token is a no-op, while a stale token conflicts', async () => {
  const original = validLead({ status: 'CONTACTED', updatedAt: 20 })
  fakeDb.seed(leadPath('lead-1'), original)
  const result = await updateLeadStatus('tenant-1', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: 20
  })
  assert.equal(result.updatedAt, 20)
  assert.deepEqual(fakeDb.data(leadPath('lead-1')), original)

  await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: 19
  }), { status: 409, message: 'Lead has changed. Refresh and try again.' })
})

test('sequential mutations strictly increase updatedAt and reject reuse of an old token', async (t) => {
  t.mock.method(Date, 'now', () => 10)
  fakeDb.seed(leadPath('lead-1'), validLead({ updatedAt: 10 }))
  const first = await updateLeadStatus('tenant-1', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: 10
  })
  const second = await updateLeadStatus('tenant-1', 'lead-1', {
    status: 'QUOTED', expectedUpdatedAt: first.updatedAt
  })
  assert.equal(first.updatedAt, 11)
  assert.equal(second.updatedAt, 12)

  await assert.rejects(updateLeadStatus('tenant-1', 'lead-1', {
    status: 'WON', expectedUpdatedAt: 10
  }), { status: 409, message: 'Lead has changed. Refresh and try again.' })
})

test('actual status mutations appear in subsequent sanitized reads', async () => {
  fakeDb.seed(leadPath('lead-1'), validLead())
  const updated = await updateLeadStatus('tenant-1', 'lead-1', {
    status: 'CONTACTED', expectedUpdatedAt: 10
  })
  const detail = await getTenantLead('tenant-1', 'lead-1')
  const list = await listTenantLeads('tenant-1')
  assert.equal(detail.status, 'CONTACTED')
  assert.equal(detail.updatedAt, updated.updatedAt)
  assert.equal(list.leads[0].status, 'CONTACTED')
  assert.equal(list.leads[0].updatedAt, updated.updatedAt)
})
