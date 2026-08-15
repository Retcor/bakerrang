import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb as setLeadDb,
  createPublicLead
} from '../services/leadService.js'
import {
  _setDb as setSiteDb,
  getPublicSite,
  initializeSite,
  publishSite,
  upsertHomeContact
} from '../services/siteService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

const normalPublicEnv = {
  NODE_ENV: 'development',
  ALLOW_DRAFT_PUBLIC_SITES: 'false'
}
const previewEnv = {
  NODE_ENV: 'development',
  ALLOW_DRAFT_PUBLIC_SITES: 'true'
}

const definition = (action, sections = null) => ({
  status: 'PUBLISHED',
  pages: [{
    id: 'home',
    slug: '/',
    title: 'Home',
    sections: sections || [
      { id: 'hero', type: 'hero', content: { title: 'Business' } },
      {
        id: 'contact',
        type: 'contact',
        content: { title: 'Contact', buttonLabel: 'Contact', action }
      }
    ]
  }]
})

const seedPublished = (action, sections) => {
  fakeDb.seed('tenants/tenant-1/site/config', { status: 'PUBLISHED' })
  fakeDb.seed('tenants/tenant-1/site/config/published/current', {
    siteDefinition: definition(action, sections),
    publishedAt: 1,
    publishedByUserId: 'admin'
  })
}

const leadPaths = () => fakeDb.paths().filter((path) =>
  path.startsWith('tenants/tenant-1/leads/')
)

beforeEach(() => {
  fakeDb = new FakeDb()
  setSiteDb(fakeDb)
  setLeadDb(fakeDb)
})

afterEach(() => {
  setLeadDb()
  setSiteDb()
})

test('createPublicLead persists approved email, phone, and server-owned fields', async () => {
  seedPublished({ type: 'leadForm' })
  const result = await createPublicLead('tenant-1', {
    id: 'client-id',
    name: '  Jamie Visitor  ',
    email: '  jamie@example.com  ',
    phone: '  (801) 555-1234  ',
    message: '  I would like more information.  ',
    status: 'CLOSED',
    source: 'CLIENT',
    createdAt: 1,
    updatedAt: 2,
    tenantId: 'wrong',
    ip: '127.0.0.1',
    arbitrary: true
  })

  assert.deepEqual(result, { success: true })
  const paths = leadPaths()
  assert.equal(paths.length, 1)
  assert.match(paths[0], /^tenants\/tenant-1\/leads\/[0-9a-f-]{36}$/)
  const lead = fakeDb.data(paths[0])
  assert.deepEqual(lead, {
    name: 'Jamie Visitor',
    email: 'jamie@example.com',
    phone: '(801) 555-1234',
    message: 'I would like more information.',
    status: 'NEW',
    source: 'WEBSITE',
    createdAt: lead.createdAt,
    updatedAt: lead.createdAt
  })
  assert.equal(typeof lead.createdAt, 'number')
})

test('createPublicLead accepts either contact method or both', async () => {
  seedPublished({ type: 'leadForm' })
  await createPublicLead('tenant-1', {
    name: 'Email', email: 'email@example.com', message: 'Email only'
  })
  await createPublicLead('tenant-1', {
    name: 'Phone', phone: '+1 801 555 1234', message: 'Phone only'
  })
  await createPublicLead('tenant-1', {
    name: 'Both', email: 'both@example.com', phone: '801-555-1234', message: 'Both'
  })
  const leads = leadPaths().map((path) => fakeDb.data(path))
  assert.equal(leads.length, 3)
  assert.equal(Object.hasOwn(leads[0], 'phone'), false)
  assert.equal(Object.hasOwn(leads[1], 'email'), false)
  assert.equal(leads[2].email, 'both@example.com')
  assert.equal(leads[2].phone, '801-555-1234')
})

test('createPublicLead validates required fields and shared contact methods', async () => {
  seedPublished({ type: 'leadForm' })
  const valid = { name: 'Visitor', email: 'hello@example.com', message: 'Hello' }
  for (const input of [{}, { ...valid, name: null }, { ...valid, name: ' ' }]) {
    await assert.rejects(createPublicLead('tenant-1', input), {
      status: 400, message: 'Lead name is required'
    })
  }
  await assert.rejects(createPublicLead('tenant-1', { ...valid, name: 'x'.repeat(121) }), {
    status: 400, message: 'Lead name must be 120 characters or fewer'
  })
  for (const email of [null, 'invalid', 'a b@example.com', `${'a'.repeat(243)}@example.com`]) {
    await assert.rejects(createPublicLead('tenant-1', { ...valid, email }), {
      status: 400, message: 'Lead email is invalid'
    })
  }
  for (const phone of [null, '123456', '801-CALL-NOW', '1234567890123456', 'x'.repeat(51)]) {
    await assert.rejects(createPublicLead('tenant-1', { ...valid, email: '', phone }), {
      status: 400, message: 'Lead phone is invalid'
    })
  }
  await assert.rejects(createPublicLead('tenant-1', {
    ...valid, email: ' ', phone: ' '
  }), { status: 400, message: 'A phone number or email address is required' })
  for (const message of [undefined, null, ' ']) {
    await assert.rejects(createPublicLead('tenant-1', { ...valid, message }), {
      status: 400, message: 'Lead message is required'
    })
  }
  await assert.rejects(createPublicLead('tenant-1', { ...valid, message: 'x'.repeat(2001) }), {
    status: 400, message: 'Lead message must be 2000 characters or fewer'
  })
})

test('createPublicLead silently suppresses only filled string honeypots', async () => {
  seedPublished({ type: 'leadForm' })
  assert.deepEqual(await createPublicLead('tenant-1', { website: 'bot.example' }), { success: true })
  assert.equal(leadPaths().length, 0)

  const valid = { name: 'Visitor', email: 'hello@example.com', message: 'Hello' }
  await createPublicLead('tenant-1', { ...valid, website: '   ' })
  await createPublicLead('tenant-1', { ...valid, website: { malformed: true } })
  assert.equal(leadPaths().length, 2)
  for (const path of leadPaths()) assert.equal(Object.hasOwn(fakeDb.data(path), 'website'), false)
})

test('createPublicLead fails closed for every ineligible published state', async () => {
  await assert.rejects(createPublicLead('tenant-1', {}), {
    status: 404, message: 'Site not found'
  })

  fakeDb.seed('tenants/tenant-1/site/config', { status: 'DRAFT' })
  await assert.rejects(createPublicLead('tenant-1', {}), {
    status: 404, message: 'Site not found'
  })

  for (const action of [null, { type: 'email', value: 'a@example.com' }, { type: 'phone', value: '8015551234' }, { type: 'url', value: 'https://example.com/' }]) {
    const sections = action === null
      ? [{ id: 'hero', type: 'hero', content: { title: 'Business' } }]
      : null
    seedPublished(action, sections)
    await assert.rejects(createPublicLead('tenant-1', {}), {
      status: 404, message: 'Site not found'
    })
  }

  seedPublished({ type: 'leadForm' })
  await createPublicLead('tenant-1', {
    name: 'Allowed', email: 'allowed@example.com', message: 'Published form'
  })
  assert.equal(leadPaths().length, 1)
})

test('lead write authority follows only the published snapshot through lifecycle changes', async () => {
  fakeDb.seed('tenants/tenant-1', { name: 'Business' })
  await initializeSite('tenant-1', 'admin')
  await upsertHomeContact('tenant-1', {
    title: 'Contact', buttonLabel: 'Email', action: { type: 'email', value: 'hello@example.com' }
  })
  await publishSite('tenant-1', 'admin')

  await upsertHomeContact('tenant-1', {
    title: 'Contact', buttonLabel: 'Form', action: { type: 'leadForm' }
  })
  const preview = await getPublicSite('tenant-1', previewEnv)
  assert.equal(preview.pages[0].sections.find((section) => section.id === 'contact').content.action.type, 'leadForm')
  await assert.rejects(createPublicLead('tenant-1', {}), {
    status: 404, message: 'Site not found'
  })

  await publishSite('tenant-1', 'admin')
  await createPublicLead('tenant-1', {
    name: 'Allowed', email: 'allowed@example.com', message: 'Now published'
  })
  assert.equal(leadPaths().length, 1)

  await upsertHomeContact('tenant-1', {
    title: 'Contact', buttonLabel: 'Call', action: { type: 'phone', value: '801-555-1234' }
  })
  await createPublicLead('tenant-1', {
    name: 'Still allowed', phone: '801-555-1234', message: 'Published form remains live'
  })
  assert.equal(leadPaths().length, 2)
  assert.equal((await getPublicSite('tenant-1', normalPublicEnv)).pages[0].sections
    .find((section) => section.id === 'contact').content.action.type, 'leadForm')

  await publishSite('tenant-1', 'admin')
  await assert.rejects(createPublicLead('tenant-1', {}), {
    status: 404, message: 'Site not found'
  })
})
