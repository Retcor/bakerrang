import test from 'node:test'
import assert from 'node:assert/strict'
import { checkAndStoreUser } from '../services/authService.js'
import { FakeDb } from './helpers/fakeDb.js'

test('Google user synchronization merge-writes and ignores arbitrary profile fields', async () => {
  const fakeDb = new FakeDb()
  fakeDb.seed('users/user-1', {
    preferences: { theme: 'dark' },
    internalFlag: true,
    displayName: 'Old Name'
  })

  await checkAndStoreUser({
    id: 'user-1',
    displayName: 'New Name',
    email: '  PERSON@Example.COM ',
    photo: 'photo-url',
    preferences: 'ATTACKER_VALUE',
    arbitrary: 'ignored'
  }, fakeDb)

  assert.deepEqual(fakeDb.data('users/user-1'), {
    preferences: { theme: 'dark' },
    internalFlag: true,
    displayName: 'New Name',
    id: 'user-1',
    email: '  PERSON@Example.COM ',
    emailLower: 'person@example.com',
    photo: 'photo-url'
  })
})
