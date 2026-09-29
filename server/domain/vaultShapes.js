const plain = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

export const validVaultId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)

export const cleanCipherBlob = (value) => {
  if (!plain(value) || typeof value.iv !== 'string' || typeof value.ct !== 'string' ||
    !/^[A-Za-z0-9+/]{16}$/.test(value.iv) ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.ct) ||
    value.ct.length < 24 || value.ct.length > 200000 ||
    Buffer.from(value.ct, 'base64').length < 16) return null
  return { iv: value.iv, ct: value.ct }
}
