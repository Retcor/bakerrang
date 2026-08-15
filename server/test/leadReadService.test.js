import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  getTenantLead,
  listTenantLeads
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
  ...overrides
})

beforeEach(() => {
  fakeDb = new FakeDb()
  fakeDb.seed(tenantPath, { name: 'Business' })
  _setDb(fakeDb)
})

afterEach(() => _setDb())

test('listTenantLeads returns an empty bounded response for an existing tenant', async () => {
  assert.deepEqual(await listTenantLeads('tenant-1'), { leads: [], hasMore: false })
})

test('listTenantLeads returns sanitized summaries newest-first and tenant-scoped', async () => {
  fakeDb.seed(leadPath('older'), validLead({ createdAt: 10, updatedAt: 11, unknown: 'drop' }))
  fakeDb.seed(leadPath('newer'), validLead({
    name: 'Newer', email: '', phone: '', createdAt: 20, updatedAt: 21, unknown: 'drop'
  }))
  fakeDb.seed(leadPath('foreign', 'tenant-2'), validLead({ createdAt: 30 }))
  const result = await listTenantLeads('tenant-1')

  assert.deepEqual(result, {
    leads: [
      {
        id: 'newer',
        name: 'Newer',
        status: 'NEW',
        source: 'WEBSITE',
        createdAt: 20,
        updatedAt: 21
      },
      {
        id: 'older',
        name: 'Visitor',
        email: 'visitor@example.com',
        phone: '801-555-1234',
        status: 'NEW',
        source: 'WEBSITE',
        createdAt: 10,
        updatedAt: 11
      }
    ],
    hasMore: false
  })
  assert.equal(Object.hasOwn(result.leads[0], 'message'), false)
  assert.equal(Object.hasOwn(result.leads[0], 'unknown'), false)
})

test('listTenantLeads limits to 50 and reports a 51st candidate', async () => {
  for (let index = 1; index <= 51; index += 1) {
    fakeDb.seed(leadPath(`lead-${index}`), validLead({
      name: `Lead ${index}`, createdAt: index, updatedAt: index
    }))
  }
  const result = await listTenantLeads('tenant-1')
  assert.equal(result.leads.length, 50)
  assert.equal(result.hasMore, true)
  assert.equal(result.leads[0].id, 'lead-51')
  assert.equal(result.leads.at(-1).id, 'lead-2')
})

test('listTenantLeads returns exactly 50 without hasMore', async () => {
  for (let index = 1; index <= 50; index += 1) {
    fakeDb.seed(leadPath(`lead-${index}`), validLead({ createdAt: index, updatedAt: index }))
  }
  const result = await listTenantLeads('tenant-1')
  assert.equal(result.leads.length, 50)
  assert.equal(result.hasMore, false)
})

test('listTenantLeads mirrors Firestore orderBy exclusion and skips malformed rows', async () => {
  const missingCreatedAt = validLead()
  delete missingCreatedAt.createdAt
  fakeDb.seed(leadPath('missing-created'), missingCreatedAt)
  fakeDb.seed(leadPath('bad-name'), validLead({ name: '', createdAt: 30 }))
  fakeDb.seed(leadPath('bad-status'), validLead({ status: null, createdAt: 20 }))
  fakeDb.seed(leadPath('valid'), validLead({ email: undefined, phone: undefined, createdAt: 10 }))
  const result = await listTenantLeads('tenant-1')
  assert.deepEqual(result, {
    leads: [{
      id: 'valid',
      name: 'Visitor',
      status: 'NEW',
      source: 'WEBSITE',
      createdAt: 10,
      updatedAt: 10
    }],
    hasMore: false
  })
})

test('listTenantLeads hasMore reflects candidates even when malformed rows are skipped', async () => {
  for (let index = 1; index <= 51; index += 1) {
    fakeDb.seed(leadPath(`lead-${index}`), validLead({
      name: index === 51 ? '' : `Lead ${index}`,
      createdAt: index,
      updatedAt: index
    }))
  }
  const result = await listTenantLeads('tenant-1')
  assert.equal(result.hasMore, true)
  assert.equal(result.leads.length, 49)
})

test('getTenantLead returns only a valid sanitized detail contract', async () => {
  fakeDb.seed(leadPath('lead-1'), validLead({ unknown: 'drop' }))
  const detail = await getTenantLead('tenant-1', 'lead-1')
  assert.deepEqual(detail, {
    id: 'lead-1',
    name: 'Visitor',
    email: 'visitor@example.com',
    phone: '801-555-1234',
    message: 'Please contact me.',
    status: 'NEW',
    source: 'WEBSITE',
    createdAt: 10,
    updatedAt: 10
  })
  assert.equal(typeof detail.createdAt, 'number')
  assert.equal(typeof detail.updatedAt, 'number')
})

test('getTenantLead omits absent optional contact methods', async () => {
  fakeDb.seed(leadPath('lead-1'), validLead({ email: undefined, phone: undefined }))
  const detail = await getTenantLead('tenant-1', 'lead-1')
  assert.equal(Object.hasOwn(detail, 'email'), false)
  assert.equal(Object.hasOwn(detail, 'phone'), false)
})

test('lead reads distinguish missing tenants, missing leads, and structural ownership', async () => {
  await assert.rejects(listTenantLeads('missing'), {
    status: 404, message: 'Tenant not found'
  })
  await assert.rejects(getTenantLead('missing', 'lead-1'), {
    status: 404, message: 'Tenant not found'
  })
  await assert.rejects(getTenantLead('tenant-1', 'missing'), {
    status: 404, message: 'Lead not found'
  })
  fakeDb.seed(leadPath('foreign', 'tenant-2'), validLead())
  await assert.rejects(getTenantLead('tenant-1', 'foreign'), {
    status: 404, message: 'Lead not found'
  })
})

test('getTenantLead fails controlled when required persisted data is malformed', async () => {
  for (const [index, overrides] of [
    { name: '' },
    { message: null },
    { status: '' },
    { source: 1 },
    { createdAt: null },
    { updatedAt: Number.NaN }
  ].entries()) {
    const id = `malformed-${index}`
    fakeDb.seed(leadPath(id), validLead(overrides))
    await assert.rejects(getTenantLead('tenant-1', id), {
      status: 500, message: 'Lead data invalid'
    })
  }
})
