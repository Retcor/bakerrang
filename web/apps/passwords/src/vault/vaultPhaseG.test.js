import { describe, expect, it } from 'vitest'
import { argon2id } from 'hash-wasm'
import { assertKdfSupported, DEFAULT_KDF, UnsupportedKdfError } from './kdf.js'
import { generatePassword, PASSWORD_CLASSES, uniformIndex } from './generator.js'
import { searchEntries } from './search.js'
import { buildIndexEntry } from './index.js'
import { createVault, unlockVault, encryptItem, decryptItem, encryptFolder, decryptFolder, unwrapFolderKeyFromVault, importFolderKey, decryptItemWithFolderKey, decryptFolderName } from './crypto.js'
import legacyFixture from './fixtures/legacy-v1.json'

describe('Phase G cryptography and index', () => {
  it('accepts the one deployed KDF shape and rejects drift before Argon2', () => {
    const exact = { ...DEFAULT_KDF, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }
    expect(assertKdfSupported(exact)).toEqual(exact)
    for (const change of [{ memory: 32768 }, { iterations: 4 }, { parallelism: 2 }, { hashLength: 64 }, { algo: 'pbkdf2' }, { salt: 'short' }]) {
      expect(() => assertKdfSupported({ ...exact, ...change })).toThrow(UnsupportedKdfError)
    }
  })

  it('rejects every dangerous KDF drift before deriving a master key', async () => {
    const exact = { ...DEFAULT_KDF, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }
    const variants = [
      { iterations: 2 }, { iterations: 4 },
      { memory: 65535 }, { memory: 65537 }, { memory: 131072 }, { memory: 1048576 },
      { parallelism: 0 }, { parallelism: 2 },
      { hashLength: 31 }, { hashLength: 33 },
      { algo: 'argon2d' }, { algo: 'argon2i' }, { algo: undefined },
      { salt: btoa('a'.repeat(15)) }, { salt: btoa('a'.repeat(17)) }, { salt: 'not-base64' }, { salt: undefined },
      { iterations: '3' }, { iterations: 3.5 }, { iterations: -1 }, { iterations: null }
    ]
    for (const change of variants) {
      const kdf = { ...exact, ...change }
      expect(() => assertKdfSupported(kdf)).toThrow(UnsupportedKdfError)
      await expect(unlockVault('synthetic passphrase', { kdf, protectedVaultKey: { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAA==' } })).rejects.toBeInstanceOf(UnsupportedKdfError)
    }
    expect(assertKdfSupported({ ...exact, futureField: 'ignored' })).toEqual(exact)
  })

  it('keeps the fixed Argon2id known answer', async () => {
    const output = await argon2id({ password: 'phase-g-known-answer', salt: Uint8Array.from({ length: 16 }, (_, i) => i), parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 32, outputType: 'hex' })
    expect(output).toBe('6bebb87da99083ec44a8b6a5b20aafd342aaf8212c4cd245642a07f38731d494')
  }, 30000)

  it('decrypts the existing envelope, and keeps the vault key non-extractable by default', async () => {
    const created = await createVault('synthetic test password')
    const meta = { kdf: created.kdf, protectedVaultKey: created.protectedVaultKey }
    const locked = await unlockVault('synthetic test password', meta)
    expect(locked.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', locked)).rejects.toThrow()
    const compatible = await unlockVault('synthetic test password', meta, { extractable: true })
    expect(compatible.extractable).toBe(true)
    expect((await crypto.subtle.exportKey('raw', compatible)).byteLength).toBe(32)
    const fields = { title: 'Example Bank', username: 'demo', password: 'synthetic secret', url: 'https://example.test', notes: 'private note' }
    const record = await encryptItem(locked, fields)
    expect(await decryptItem(compatible, record)).toEqual(fields)
    const folder = await encryptFolder(locked, { name: 'Banking' })
    expect(await decryptFolder(compatible, folder)).toEqual({ name: 'Banking' })
    await expect(unlockVault('wrong password', meta)).rejects.toThrow()
  }, 30000)

  it('opens ciphertext written by the unchanged legacy client, including pre-sharing and recipient entries', async () => {
    expect(assertKdfSupported(legacyFixture.meta.kdf)).toEqual(legacyFixture.meta.kdf)
    expect(assertKdfSupported(legacyFixture.preSharingMeta.kdf)).toEqual(legacyFixture.preSharingMeta.kdf)
    for (const meta of [legacyFixture.meta, legacyFixture.preSharingMeta]) {
      const key = await unlockVault(legacyFixture.masterPassword, meta)
      expect(await decryptItem(key, legacyFixture.records.ordinary)).toEqual(legacyFixture.expected.ordinary)
      expect(await decryptItem(key, legacyFixture.records.sharedOwner)).toEqual(legacyFixture.expected.sharedOwner)
      expect(await decryptFolder(key, legacyFixture.folders.ordinary)).toEqual({ name: 'Private folder' })
      const raw = await unwrapFolderKeyFromVault(key, legacyFixture.folders.shared.wrappedFolderKey)
      const folderKey = await importFolderKey(raw)
      expect(await decryptFolderName(folderKey, legacyFixture.folders.shared.sharedName)).toEqual({ name: 'Shared folder' })
      expect(await decryptItemWithFolderKey(folderKey, legacyFixture.records.sharedRecipient)).toEqual(legacyFixture.expected.sharedRecipient)
    }
  }, 30000)

  it('retains only the seven approved index fields and searches no notes', async () => {
    const created = await createVault('synthetic test password')
    const record = { id: 'item-1', folderId: null, rev: 3, ...await encryptItem(created.vaultKey, { title: 'Example Bank', username: 'demo', password: 'sentinel-secret', url: 'bank.example.test', notes: 'sentinel-note' }) }
    const entry = await buildIndexEntry(record, { vaultKey: created.vaultKey })
    expect(Object.keys(entry).sort()).toEqual(['folderId', 'id', 'rev', 'source', 'title', 'url', 'username'])
    expect(JSON.stringify(entry)).not.toContain('sentinel')
    expect(searchEntries([entry], 'EXAMPLE demo')).toHaveLength(1)
    expect(searchEntries([entry], 'sentinel')).toHaveLength(0)
  }, 30000)
})

describe('password generator', () => {
  it('uses rejection sampling rather than reducing rejected Uint32 values', () => {
    let calls = 0
    const random = { getRandomValues (array) { array[0] = calls++ === 0 ? 4294967295 : 7; return array } }
    expect(uniformIndex(76, random)).toBe(7)
    expect(calls).toBe(2)
  })

  it('includes each enabled class at the allowed lengths', () => {
    for (const length of [12, 20, 64]) {
      const password = generatePassword({ length, symbols: true })
      expect(password).toHaveLength(length)
      for (const group of Object.values(PASSWORD_CLASSES)) expect([...password].some((char) => group.includes(char))).toBe(true)
    }
    const noSymbols = generatePassword({ symbols: false })
    expect([...noSymbols].some((char) => PASSWORD_CLASSES.symbols.includes(char))).toBe(false)
  })

  it('rejects lengths outside 12–64', () => {
    expect(() => generatePassword({ length: 11 })).toThrow()
    expect(() => generatePassword({ length: 65 })).toThrow()
  })
})
