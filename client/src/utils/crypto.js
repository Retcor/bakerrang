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

// Creates a brand-new vault (with a sharing keypair). Returns the server payload
// plus the live vault key.
export const createVault = async (masterPassword) => {
  const kdf = { ...DEFAULT_KDF, salt: toBase64(randomBytes(16)) }
  const masterKey = await deriveMasterKey(masterPassword, kdf)
  const vaultKeyRaw = randomBytes(32)
  const protectedVaultKey = await encryptBytes(masterKey, vaultKeyRaw)
  const vaultKey = await importAesKey(vaultKeyRaw)
  const { publicKey, protectedPrivateKey } = await createKeyPair(vaultKey)
  return { kdf, protectedVaultKey, vaultKey, publicKey, protectedPrivateKey }
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

// ---- Sharing: per-user keypair (Phase 2) ----
//
// Each user has an RSA-OAEP keypair. The public key (plaintext) lets others wrap
// a folder key TO this user; the private key (stored AES-GCM-wrapped by the
// vault key) unwraps folder keys shared WITH this user. The server never sees
// the private key in the clear.

const RSA_PARAMS = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }

// Returns { publicKey: base64(SPKI), protectedPrivateKey: {iv,ct} }.
export const createKeyPair = async (vaultKey) => {
  const pair = await subtle.generateKey(RSA_PARAMS, true, ['encrypt', 'decrypt'])
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey))
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey))
  const protectedPrivateKey = await encryptBytes(vaultKey, pkcs8)
  return { publicKey: toBase64(spki), protectedPrivateKey }
}

// Unwraps the private key (held in memory only) using the vault key.
export const unwrapPrivateKey = async (vaultKey, protectedPrivateKey) => {
  const pkcs8 = await decryptBytes(vaultKey, protectedPrivateKey)
  return subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
}

export const importPublicKey = (spkiBase64) =>
  subtle.importKey('spki', fromBase64(spkiBase64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])

// Wrap/unwrap a raw symmetric key (e.g. a folder key) to/from a public key.
export const wrapKeyForRecipient = async (rawKeyBytes, recipientPublicKey) => {
  const ct = new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, recipientPublicKey, rawKeyBytes))
  return toBase64(ct)
}

export const unwrapKeyFromSender = async (b64, privateKey) =>
  new Uint8Array(await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromBase64(b64)))

// ---- Sharing: folder keys ----
//
// A shared folder has a random folder key. Item content keys in the folder are
// wrapped by it (folderWrappedItemKey), and the folder key is wrapped to the
// owner (vault key) and to each recipient (their public key). Everyone with the
// folder key can decrypt every item in the folder.

export const generateFolderKeyRaw = () => randomBytes(32)

export const importFolderKey = (rawBytes) => importAesKey(rawBytes)

// Owner's copy of the folder key, wrapped by the vault key.
export const wrapFolderKeyForVault = (vaultKey, folderKeyRaw) => encryptBytes(vaultKey, folderKeyRaw)
export const unwrapFolderKeyFromVault = (vaultKey, blob) => decryptBytes(vaultKey, blob)

// Re-wrap an existing item's content key so a folder key can decrypt it.
export const rewrapItemKeyForFolder = async (vaultKey, folderKey, record) => {
  const itemKeyRaw = await decryptBytes(vaultKey, record.wrappedItemKey)
  return encryptBytes(folderKey, itemKeyRaw) // -> folderWrappedItemKey
}

// Encrypt an item so both the vault key (owner) and the folder key (sharing) can
// open it. Used when creating/editing items in a shared folder.
export const encryptItemForFolder = async (vaultKey, folderKey, item) => {
  const itemKeyRaw = randomBytes(32)
  const itemKey = await importAesKey(itemKeyRaw)
  const ciphertext = await encryptJson(itemKey, item)
  return {
    ciphertext,
    wrappedItemKey: vaultKey ? await encryptBytes(vaultKey, itemKeyRaw) : null,
    folderWrappedItemKey: await encryptBytes(folderKey, itemKeyRaw)
  }
}

// Decrypt an item via the folder key (used by recipients and by the owner for
// shared folders).
export const decryptItemWithFolderKey = async (folderKey, record) => {
  const itemKeyRaw = await decryptBytes(folderKey, record.folderWrappedItemKey)
  const itemKey = await importAesKey(itemKeyRaw)
  return decryptJson(itemKey, record.ciphertext)
}

// Re-encrypt just the content (keeps the same content key) — used when editing a
// shared item; returns the new ciphertext given the item's content key raw bytes.
export const encryptFolderName = (folderKey, name) => encryptJson(folderKey, { name })
export const decryptFolderName = (folderKey, blob) => decryptJson(folderKey, blob)
