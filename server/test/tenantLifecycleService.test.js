import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { _setDb as setSiteDb, initializeSite, updateSiteTheme, addSection } from '../services/siteService.js'
import { _setDb as setLeadDb, createPublicLead } from '../services/leadService.js'
import { _setDb as setMediaDb, _setStorage as setMediaStorage, createMedia } from '../services/mediaService.js'
import { _setDb as setNotificationDb, _setSender, processLeadNotification } from '../services/leadNotificationService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

const image = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000030802000000', 'hex')
const theme = {
  colors: {
    primary: '#112233', accent: '#445566', background: '#f8fafc', text: '#172033'
  },
  headingFont: 'poppins',
  bodyFont: 'lora',
  cornerStyle: 'rounded',
  contentWidth: 'wide',
  sectionSpacing: 'spacious'
}

let database
let storage

const reset = () => {
  database = new FakeDb().seed('tenants/tenant-1', { name: 'Tenant', status: 'ACTIVE' })
  storage = new FakeStorage()
  setSiteDb(database)
  setLeadDb(database)
  setMediaDb(database)
  setMediaStorage(storage)
  setNotificationDb(database)
}

const flipPendingAtFirstWrite = (pathPart) => {
  let flipped = false
  database.beforeCommit = async ({ writes }) => {
    if (!flipped && writes.some((write) => write.ref.path.includes(pathPart))) {
      flipped = true
      database.write('tenants/tenant-1', { name: 'Tenant', status: 'PENDING_DELETE' })
    }
  }
}

afterEach(() => {
  setSiteDb()
  setLeadDb()
  setMediaDb()
  setMediaStorage()
  setNotificationDb()
  _setSender()
})

test('site config and section mutations retry against the tenant lifecycle write barrier', async () => {
  reset()
  await initializeSite('tenant-1', 'platform')
  const original = database.data('tenants/tenant-1/site/config')
  flipPendingAtFirstWrite('/site/config')
  await assert.rejects(updateSiteTheme('tenant-1', theme), { status: 409 })
  assert.deepEqual(database.data('tenants/tenant-1/site/config'), original)

  database.write('tenants/tenant-1', { name: 'Tenant', status: 'ACTIVE' })
  flipPendingAtFirstWrite('/pages/home')
  await assert.rejects(addSection('tenant-1', 'home', 'faq'), { status: 409 })
  assert.equal(database.data('tenants/tenant-1/site/config/pages/home').sections.some((section) => section.type === 'faq'), false)
})

test('public lead and media upload cleanly fail when deletion wins their metadata transaction', async () => {
  reset()
  database.seed('tenants/tenant-1/site/config', { status: 'PUBLISHED' })
  database.seed('tenants/tenant-1/site/config/published/current', {
    siteDefinition: {
      status: 'PUBLISHED',
      pages: [{
        id: 'home',
        slug: '/',
        title: 'Home',
        sections: [
          {
            id: 'hero', type: 'hero', hidden: false, content: { title: 'Tenant' }
          },
          {
            id: 'contact',
            type: 'contact',
            hidden: false,
            content: {
              title: 'Contact', buttonLabel: 'Contact', action: { type: 'leadForm' }
            }
          }
        ]
      }]
    }
  })
  flipPendingAtFirstWrite('/leads/')
  await assert.rejects(createPublicLead('tenant-1', {
    name: 'Visitor', email: 'visitor@example.test', message: 'Hello'
  }), { status: 404, message: 'Site not found' })
  assert.equal(database.paths().some((path) => path.includes('/leads/')), false)
  assert.equal(database.paths().some((path) => path.startsWith('leadNotifications/')), false)

  database.beforeCommit = null
  database.write('tenants/tenant-1', { name: 'Tenant', status: 'ACTIVE' })
  flipPendingAtFirstWrite('/media/')
  await assert.rejects(createMedia('tenant-1', {
    mimetype: 'image/png', buffer: image, originalname: 'image.png'
  }, 'platform'), { status: 409 })
  assert.equal(database.paths().some((path) => path.includes('/media/')), false)
  assert.equal(storage.objects.size, 0)
})

test('notification claiming stops at pending deletion and settle cannot recreate a removed outbox document', async () => {
  reset()
  database.write('tenants/tenant-1', { name: 'Tenant', status: 'PENDING_DELETE' })
  database.seed('leadNotifications/pending', {
    tenantId: 'tenant-1',
    leadId: 'lead',
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: 0,
    deliverySnapshot: { recipients: ['ops@example.test'] }
  })
  assert.deepEqual(await processLeadNotification('pending', { now: 1 }), { claimed: false, sent: false })
  assert.equal(database.data('leadNotifications/pending'), undefined)

  database.write('tenants/tenant-1', { name: 'Tenant', status: 'ACTIVE' })
  database.seed('leadNotifications/running', {
    tenantId: 'tenant-1',
    leadId: 'lead',
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: 0,
    deliverySnapshot: { recipients: ['ops@example.test'] }
  })
  _setSender(async () => { database.remove('leadNotifications/running') })
  assert.deepEqual(await processLeadNotification('running', { now: 1 }), { claimed: true, sent: false })
  assert.equal(database.data('leadNotifications/running'), undefined)
})
