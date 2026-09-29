import { expect, it } from 'vitest'
import { ensureArgon2, getKdbxweb } from './kdbx.js'

it('exports and reopens a synthetic KeePass file with the patched XML parser', async () => {
  const kdbxweb = getKdbxweb()
  ensureArgon2()
  const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString('synthetic export password'))
  const db = kdbxweb.Kdbx.create(credentials, 'BakerRang synthetic vault')
  const entry = db.createEntry(db.getDefaultGroup())
  entry.fields.set('Title', 'Example Bank')
  entry.fields.set('Password', kdbxweb.ProtectedValue.fromString('synthetic secret'))
  const binary = await db.save()
  const reopened = await kdbxweb.Kdbx.load(binary, credentials)
  const restored = reopened.getDefaultGroup().entries[0]
  expect(restored.fields.get('Title')).toBe('Example Bank')
  expect(restored.fields.get('Password').getText()).toBe('synthetic secret')
}, 30000)
