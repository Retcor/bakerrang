export const VAULT_KDF = Object.freeze({
  algo: 'argon2id', iterations: 3, memory: 65536, parallelism: 1, hashLength: 32
})

export const cleanVaultKdf = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.entries(VAULT_KDF).some(([key, expected]) => value[key] !== expected) ||
    typeof value.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(value.salt) ||
    Buffer.from(value.salt, 'base64').length !== 16) return null
  return { ...VAULT_KDF, salt: value.salt }
}
