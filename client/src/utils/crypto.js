import { argon2id } from 'hash-wasm'

// Zero-knowledge vault cryptography. Everything here runs in the browser; the
// server only ever receives the opaque { iv, ct } blobs produced below and
// never the master password or any plaintext.
//
// Key hierarchy:
//   masterKey       = Argon2id(masterPassword, kdf.salt)      (never leaves JS)
//   vaultKey        = random AES-256 key                      (the data key)
//   protectedVaultKey = AES-GCM(vaultKey, masterKey)          (stored on server)
//   per item:
//     itemKey       = random AES-256 key
//     ciphertext    = AES-GCM(JSON(item), itemKey)            (stored on server)
//     wrappedItemKey= AES-GCM(itemKey, vaultKey)              (stored on server)
//
// Per-item keys mean Phase 2 sharing can re-wrap a single item key to another
// user without touching the rest of the vault.

const subtle = globalThis.crypto.subtle

// Argon2id defaults: 64 MiB, 3 passes. Strong for a browser without being
// unusably slow. Persisted in kdf metadata so future unlocks match.
export const DEFAULT_KDF = {
  algo: 'argon2id',
  iterations: 3,
  memory: 65536, // KiB (64 MiB)
  parallelism: 1,
  hashLength: 32
}

const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))

const enc = new TextEncoder()
const dec = new TextDecoder()

const toBase64 = (bytes) => {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

const fromBase64 = (b64) => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ---- Low-level AES-GCM ----

const importAesKey = (rawBytes) =>
  subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])

const exportRawKey = async (key) => new Uint8Array(await subtle.exportKey('raw', key))

// Returns { iv, ct } as base64 strings.
const encryptBytes = async (key, plaintextBytes) => {
  const iv = randomBytes(12)
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes))
  return { iv: toBase64(iv), ct: toBase64(ct) }
}

// Throws if the key is wrong (GCM authentication tag mismatch).
const decryptBytes = async (key, blob) => {
  const iv = fromBase64(blob.iv)
  const ct = fromBase64(blob.ct)
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct))
}

const encryptJson = (key, obj) => encryptBytes(key, enc.encode(JSON.stringify(obj)))
const decryptJson = async (key, blob) => JSON.parse(dec.decode(await decryptBytes(key, blob)))

// ---- Master key derivation ----

const deriveMasterKey = async (masterPassword, kdf) => {
  const hash = await argon2id({
    password: masterPassword,
    salt: fromBase64(kdf.salt),
    parallelism: kdf.parallelism,
    iterations: kdf.iterations,
    memorySize: kdf.memory,
    hashLength: kdf.hashLength,
    outputType: 'binary'
  })
  return importAesKey(hash)
}

// ---- Vault lifecycle ----

// Creates a brand-new vault. Returns the server payload plus the live vault key.
export const createVault = async (masterPassword) => {
  const kdf = { ...DEFAULT_KDF, salt: toBase64(randomBytes(16)) }
  const masterKey = await deriveMasterKey(masterPassword, kdf)
  const vaultKeyRaw = randomBytes(32)
  const protectedVaultKey = await encryptBytes(masterKey, vaultKeyRaw)
  const vaultKey = await importAesKey(vaultKeyRaw)
  return { kdf, protectedVaultKey, vaultKey }
}

// Unlocks an existing vault. Throws if the master password is wrong.
export const unlockVault = async (masterPassword, vaultMeta) => {
  const masterKey = await deriveMasterKey(masterPassword, vaultMeta.kdf)
  const vaultKeyRaw = await decryptBytes(masterKey, vaultMeta.protectedVaultKey)
  return importAesKey(vaultKeyRaw)
}

// Re-wraps the existing vault key under a new master password. Item ciphertext
// is untouched because items are encrypted with the vault key, not the master
// key.
export const rewrapVaultKey = async (newMasterPassword, vaultKey) => {
  const kdf = { ...DEFAULT_KDF, salt: toBase64(randomBytes(16)) }
  const masterKey = await deriveMasterKey(newMasterPassword, kdf)
  const vaultKeyRaw = await exportRawKey(vaultKey)
  const protectedVaultKey = await encryptBytes(masterKey, vaultKeyRaw)
  return { kdf, protectedVaultKey }
}

// ---- Items ----

// item = { title, username, password, url, notes }
export const encryptItem = async (vaultKey, item) => {
  const itemKeyRaw = randomBytes(32)
  const itemKey = await importAesKey(itemKeyRaw)
  const ciphertext = await encryptJson(itemKey, item)
  const wrappedItemKey = await encryptBytes(vaultKey, itemKeyRaw)
  return { ciphertext, wrappedItemKey }
}

export const decryptItem = async (vaultKey, record) => {
  const itemKeyRaw = await decryptBytes(vaultKey, record.wrappedItemKey)
  const itemKey = await importAesKey(itemKeyRaw)
  return decryptJson(itemKey, record.ciphertext)
}

// ---- Folders (folder metadata is just an encrypted { name }) ----

export const encryptFolder = async (vaultKey, folder) => ({
  ciphertext: await encryptJson(vaultKey, folder)
})

export const decryptFolder = (vaultKey, record) => decryptJson(vaultKey, record.ciphertext)
