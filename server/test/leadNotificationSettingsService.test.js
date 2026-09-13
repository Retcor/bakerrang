import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _setDb,
  getLeadNotificationSettings,
  leadNotificationRecipientLimit,
  updateLeadNotificationSettings
} from '../services/leadNotificationSettingsService.js'
import { FakeDb } from './helpers/fakeDb.js'

let fakeDb

beforeEach(() => {
  fakeDb = new FakeDb()
  _setDb(fakeDb)
  fakeDb.seed('tenants/tenant-1', { name: 'Tenant' })
})

afterEach(() => _setDb())

test('notification settings GET defaults to enabled with no recipients', async () => {
  assert.deepEqual(await getLeadNotificationSettings('tenant-1'), { enabled: true, recipients: [] })
})

test('notification settings PUT stores canonical enabled values and preserves unrelated config', async () => {
  fakeDb.seed('tenants/tenant-1/site/config', { branding: { siteName: 'Bakery' }, futureField: true })
  const enabled = await updateLeadNotificationSettings('tenant-1', {
    enabled: true, recipients: ['  Ops@Example.com ', 'second@example.com']
  })
  assert.deepEqual(enabled, { enabled: true, recipients: ['ops@example.com', 'second@example.com'] })
  assert.deepEqual(fakeDb.data('tenants/tenant-1/site/config'), {
    branding: { siteName: 'Bakery' }, futureField: true, leadNotifications: enabled
  })
  assert.deepEqual(await updateLeadNotificationSettings('tenant-1', { enabled: false, recipients: [] }), {
    enabled: false, recipients: []
  })
})

test('notification settings retry after a concurrent config change and preserve both updates', async () => {
  const configPath = 'tenants/tenant-1/site/config'
  fakeDb.seed(configPath, { branding: { siteName: 'Bakery' }, unrelated: 'before' })
  let injectedConcurrentWrite = false
  fakeDb.beforeCommit = async () => {
    if (injectedConcurrentWrite) return
    injectedConcurrentWrite = true
    fakeDb.write(configPath, { unrelated: 'concurrent change' }, { merge: true })
  }

  await updateLeadNotificationSettings('tenant-1', {
    enabled: false,
    recipients: ['ops@example.com']
  })

  assert.equal(injectedConcurrentWrite, true)
  assert.equal(fakeDb.transactionAttempts, 2, 'the stale settings transaction must retry')
  assert.deepEqual(fakeDb.data(configPath), {
    branding: { siteName: 'Bakery' },
    unrelated: 'concurrent change',
    leadNotifications: { enabled: false, recipients: ['ops@example.com'] }
  })
})

test('notification settings reject invalid, duplicate, and excessive recipients', async () => {
  for (const input of [
    { enabled: true, recipients: ['invalid'] },
    { enabled: true, recipients: ['Ops@example.com', ' ops@example.com '] },
    { enabled: true, recipients: Array.from({ length: leadNotificationRecipientLimit + 1 }, (_, index) => `lead${index}@example.com`) }
  ]) await assert.rejects(updateLeadNotificationSettings('tenant-1', input), { status: 400 })
})
