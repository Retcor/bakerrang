import * as kdbxwebModule from 'kdbxweb'
import { argon2d, argon2id } from 'hash-wasm'

// kdbxweb ships a webpack UMD bundle; depending on the bundler's CJS interop the
// full API lands on either the default export or the namespace itself. Normalise
// so kdbxweb.CryptoEngine/Kdbx/Credentials/ProtectedValue are always present.
const kdbxweb = kdbxwebModule.default || kdbxwebModule

// Single source of truth for both KeePass import and export.
export const getKdbxweb = () => kdbxweb

// KDBX4 files use Argon2 for key derivation, which kdbxweb does not bundle.
// Wire hash-wasm's implementation in. kdbxweb passes memory already in KiB,
// type 0 = Argon2d, type 2 = Argon2id. Required for both loading and SAVING
// KDBX4 databases (Kdbx.create defaults to KDBX4/Argon2). Idempotent.
let argon2Registered = false
export const ensureArgon2 = () => {
  if (argon2Registered) return
  kdbxweb.CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism, type) => {
    const fn = type === kdbxweb.CryptoEngine.Argon2TypeArgon2id ? argon2id : argon2d
    const hash = await fn({
      password: new Uint8Array(password),
      salt: new Uint8Array(salt),
      parallelism,
      iterations,
      memorySize: memory,
      hashLength: length,
      outputType: 'binary'
    })
    return hash.buffer
  })
  argon2Registered = true
}
