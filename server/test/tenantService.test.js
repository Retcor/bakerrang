import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { checkAndStoreUser } from '../services/authService.js'
import {
  _setDb,
  addMember,
  createTenant,
  getMembership,
  getPlatformRole,
  getTenant,
  listMembers,
  listTenants
} from '../services/tenantService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
  _setDb(fakeDb)
})

afterEach(() => {
  _setDb()
})

test('createTenant writes only the approved ACTIVE tenant shape and no creator membership', async () => {
  const tenant = await createTenant('platform-admin', {
    name: '  Baker Street Cafe  ',
    slug: 'ignored',
    platformRole: 'ignored'
  })

  assert.match(tenant.id, /^[0-9a-f-]{36}$/)
  const stored = fakeDb.data(`tenants/${tenant.id}`)
  assert.deepEqual(Object.keys(stored).sort(), [
    'createdAt',
    'createdByUserId',
    'name',
    'status',
    'updatedAt'
  ])
  assert.equal(stored.name, 'Baker Street Cafe')
  assert.equal(stored.status, 'ACTIVE')
  assert.equal(stored.createdByUserId, 'platform-admin')
  assert.equal(stored.createdAt, stored.updatedAt)
  assert.equal(fakeDb.data(`tenants/${tenant.id}/members/platform-admin`), undefined)
})

test('createTenant validates name and top-level tenant operations return ids without persisting them', async () => {
  await assert.rejects(createTenant('admin', {}), { status: 400 })
  await assert.rejects(createTenant('admin', { name: '   ' }), { status: 400 })
  await assert.rejects(createTenant('admin', { name: 'x'.repeat(201) }), { status: 400 })

  const created = await createTenant('admin', { name: 'One' })
  assert.equal((await getTenant(created.id)).id, created.id)
  assert.deepEqual((await listTenants()).map((tenant) => tenant.id), [created.id])
  assert.equal(Object.hasOwn(fakeDb.data(`tenants/${created.id}`), 'id'), false)
  await assert.rejects(getTenant('missing'), { status: 404 })
})

test('addMember validates references and writes the exact approved membership shape', async () => {
  fakeDb
    .seed('tenants/tenant-1', { name: 'One' })
    .seed('users/staff-1', { id: 'staff-1' })

  const member = await addMember('tenant-1', {
    userId: 'staff-1',
    role: 'STAFF',
    ignored: true
  }, 'platform-admin')

  assert.deepEqual(Object.keys(member).sort(), [
    'createdAt',
    'createdByUserId',
    'role',
    'updatedAt',
    'userId'
  ])
  assert.equal(member.createdAt, member.updatedAt)
  assert.equal(member.createdByUserId, 'platform-admin')
  assert.deepEqual(await getMembership('tenant-1', 'staff-1'), member)
  assert.deepEqual(await listMembers('tenant-1'), [member])
})

test('addMember rejects invalid roles, missing tenants, missing users, and duplicates', async () => {
  fakeDb
    .seed('tenants/tenant-1', { name: 'One' })
    .seed('users/user-1', { id: 'user-1' })

  await assert.rejects(
    addMember('tenant-1', { userId: 'user-1', role: 'SUPERADMIN' }, 'admin'),
    { status: 400 }
  )
  await assert.rejects(
    addMember('missing', { userId: 'user-1', role: 'OWNER' }, 'admin'),
    { status: 404, message: 'Tenant not found' }
  )
  await assert.rejects(
    addMember('tenant-1', { userId: 'missing', role: 'OWNER' }, 'admin'),
    { status: 404, message: 'User not found' }
  )

  await addMember('tenant-1', { userId: 'user-1', role: 'OWNER' }, 'admin')
  await assert.rejects(
    addMember('tenant-1', { userId: 'user-1', role: 'STAFF' }, 'admin'),
    { status: 409 }
  )
  assert.equal((await getMembership('tenant-1', 'user-1')).role, 'OWNER')
  await assert.rejects(listMembers('missing'), { status: 404 })
})

test('platform roles are read from the current user document', async () => {
  fakeDb.seed('users/user-1', { platformRole: 'PLATFORM_ADMIN' })
  assert.equal(await getPlatformRole('user-1'), 'PLATFORM_ADMIN')
  fakeDb.seed('users/user-1', { displayName: 'No role now' })
  assert.equal(await getPlatformRole('user-1'), undefined)
})

test('Google user synchronization preserves platformRole and ignores arbitrary profile fields', async () => {
  fakeDb.seed('users/user-1', {
    platformRole: 'PLATFORM_ADMIN',
    internalFlag: true,
    displayName: 'Old Name'
  })

  await checkAndStoreUser({
    id: 'user-1',
    displayName: 'New Name',
    email: '  PERSON@Example.COM ',
    photo: 'photo-url',
    platformRole: 'ATTACKER_VALUE',
    arbitrary: 'ignored'
  }, fakeDb)

  assert.deepEqual(fakeDb.data('users/user-1'), {
    platformRole: 'PLATFORM_ADMIN',
    internalFlag: true,
    displayName: 'New Name',
    id: 'user-1',
    email: '  PERSON@Example.COM ',
    emailLower: 'person@example.com',
    photo: 'photo-url'
  })
})
