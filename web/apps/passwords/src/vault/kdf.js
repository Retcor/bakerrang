export const DEFAULT_KDF = Object.freeze({
  algo: 'argon2id', iterations: 3, memory: 65536, parallelism: 1, hashLength: 32
})

export class UnsupportedKdfError extends Error {
  constructor () {
    super("This vault uses settings Passwords doesn't support. Nothing was changed.")
    this.name = 'UnsupportedKdfError'
  }
}

export const assertKdfSupported = (kdf) => {
  if (!kdf || typeof kdf !== 'object' || Array.isArray(kdf) ||
    Object.entries(DEFAULT_KDF).some(([key, expected]) => kdf[key] !== expected) ||
    typeof kdf.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(kdf.salt)) throw new UnsupportedKdfError()
  let bytes
  try { bytes = atob(kdf.salt) } catch { throw new UnsupportedKdfError() }
  if (bytes.length !== 16) throw new UnsupportedKdfError()
  return { ...DEFAULT_KDF, salt: kdf.salt }
}
