import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  _setStorage,
  authorizeTenantDeletion,
  deleteTenant,
  getTenantDeletion,
  resumeTenantDeletion
} from '../services/tenantDeletionService.js'
import { FakeDb } from './helpers/fakeDb.js'
import { FakeStorage } from './helpers/fakeStorage.js'

let database
let storage

const reset = () => {
  database = new FakeDb()
  storage = new FakeStorage()
  _setDb(database)
  _setStorage(storage)
}

afterEach(() => {
  _setDb()
  _setStorage()
})

const seedTenant = (id = 'tenant-a') => {
  database.seed(`tenants/${id}`, { name: 'A Bakery', status: 'ACTIVE' })
  database.seed(`tenants/${id}/site/config`, { status: 'PUBLISHED' })
  database.seed(`tenants/${id}/site/config/pages/home`, { id: 'home' })
  database.seed(`tenants/${id}/leads/lead-a`, { name: 'Lead' })
  database.seed(`tenants/${id}/leads/lead-a/notes/note-a`, { text: 'note' })
  database.seed(`tenants/${id}/auditEvents/audit-a`, { action: 'site.publish' })
  database.seed(`tenants/${id}/media/media-a`, { objectName: `tenants/${id}/media/media-a` })
  storage.objects.set(`tenants/${id}/media/media-a`, Buffer.from('tenant-a'))
}

test('deletion removes only the authorized tenant subtree and explicitly scoped global resources', async () => {
  reset()
  seedTenant()
  seedTenant('tenant-b')
  database.seed('leadNotifications/tenant-a', { tenantId: 'tenant-a' })
  database.seed('leadNotifications/tenant-b', { tenantId: 'tenant-b' })
  database.seed('siteDomains/a.example.test', {
    tenantId: 'tenant-a', hostname: 'a.example.test'
  })
  database.seed('siteDomains/a-second.example.test', {
    tenantId: 'tenant-a', hostname: 'a-second.example.test'
  })
  database.seed('siteDomains/b.example.test', {
    tenantId: 'tenant-b', hostname: 'b.example.test'
  })
  database.seed('tenantSiteDomains/tenant-a', { hostname: 'a.example.test' })
  database.seed('tenantSiteDomains/tenant-b', { hostname: 'b.example.test' })
  database.seed('users/user-a', { email: 'user@example.test' })
  database.seed('vaults/user-a', { ciphertext: 'legacy' })
  storage.objects.set('tenants/tenant-b/media/media-b', Buffer.from('tenant-b'))
  storage.objects.set('unrelated/object', Buffer.from('untouched'))

  assert.deepEqual(await deleteTenant('tenant-a', 'A Bakery', 'platform-user'), {
    tenantId: 'tenant-a', status: 'COMPLETE'
  })

  assert.equal(database.paths().some((path) => path === 'tenants/tenant-a' || path.startsWith('tenants/tenant-a/')), false)
  assert.equal(database.data('leadNotifications/tenant-a'), undefined)
  assert.equal(database.data('siteDomains/a.example.test'), undefined)
  assert.equal(database.data('siteDomains/a-second.example.test'), undefined)
  assert.equal(database.data('tenantSiteDomains/tenant-a'), undefined)
  assert.equal(storage.objects.has('tenants/tenant-a/media/media-a'), false)
  assert.deepEqual(database.data('tenantDeletionJobs/tenant-a'), {
    tenantId: 'tenant-a',
    status: 'COMPLETE',
    requestedAt: database.data('tenantDeletionJobs/tenant-a').requestedAt,
    requestedByUserId: 'platform-user',
    updatedAt: database.data('tenantDeletionJobs/tenant-a').updatedAt,
    lastError: null
  })

  assert.ok(database.data('tenants/tenant-b'))
  assert.ok(database.data('leadNotifications/tenant-b'))
  assert.ok(database.data('siteDomains/b.example.test'))
  assert.ok(database.data('users/user-a'))
  assert.ok(database.data('vaults/user-a'))
  assert.ok(storage.objects.has('tenants/tenant-b/media/media-b'))
  assert.ok(storage.objects.has('unrelated/object'))
  assert.deepEqual(storage.deletePrefixes, ['tenants/tenant-a/media/'])
})

test('authorization is atomic, exact-name protected, and resume converges after cleanup failure', async () => {
  reset()
  seedTenant()
  await assert.rejects(deleteTenant('tenant-a', 'Wrong name', 'platform-user'), { status: 400 })
  assert.equal(database.data('tenants/tenant-a').status, 'ACTIVE')
  assert.equal(database.data('tenantDeletionJobs/tenant-a'), undefined)

  storage.deleteFilesError = new Error('storage unavailable')
  await assert.rejects(deleteTenant('tenant-a', 'A Bakery', 'platform-user'), { status: 500 })
  assert.equal(database.data('tenants/tenant-a').status, 'PENDING_DELETE')
  assert.equal(database.data('tenantDeletionJobs/tenant-a').status, 'FAILED')
  assert.equal(database.data('tenantDeletionJobs/tenant-a').lastError, 'Tenant deletion cleanup failed')

  storage.deleteFilesError = null
  assert.deepEqual(await resumeTenantDeletion('tenant-a'), { tenantId: 'tenant-a', status: 'COMPLETE' })
  assert.equal(database.data('tenants/tenant-a'), undefined)
  assert.equal(database.data('tenantDeletionJobs/tenant-a').status, 'COMPLETE')
  await assert.rejects(resumeTenantDeletion('not-authorized'), { status: 404 })
})

test('authorization transition is transactionally all-or-nothing and status is readable after tenant removal', async () => {
  reset()
  seedTenant()
  database.beforeCommit = async ({ writes }) => {
    if (writes.some((write) => write.ref.path === 'tenantDeletionJobs/tenant-a')) throw new Error('job write failed')
  }
  await assert.rejects(authorizeTenantDeletion('tenant-a', 'A Bakery', 'platform-user'))
  assert.equal(database.data('tenants/tenant-a').status, 'ACTIVE')
  assert.equal(database.data('tenantDeletionJobs/tenant-a'), undefined)

  database.beforeCommit = null
  await deleteTenant('tenant-a', 'A Bakery', 'platform-user')
  assert.deepEqual(await getTenantDeletion('tenant-a'), { tenantId: 'tenant-a', status: 'COMPLETE' })
})
