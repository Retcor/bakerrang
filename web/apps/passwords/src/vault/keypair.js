import { createKeyPair, unwrapPrivateKey } from './crypto.js'
import { vaultApi, vaultRequest } from '../api/vault.js'

export const ensureKeypair = async (vaultKey, meta, signal) => {
  if (meta.publicKey && meta.protectedPrivateKey) {
    return { meta, privateKey: await unwrapPrivateKey(vaultKey, meta.protectedPrivateKey) }
  }
  const generated = await createKeyPair(vaultKey)
  try {
    await vaultApi.keys(generated, signal)
    return { meta: { ...meta, ...generated }, privateKey: await unwrapPrivateKey(vaultKey, generated.protectedPrivateKey) }
  } catch (error) {
    if (error.status !== 409 || error.code !== 'keys_exist') throw error
    const fresh = await vaultRequest('', { signal })
    if (!fresh.publicKey || !fresh.protectedPrivateKey) throw new Error('Sharing keys unavailable')
    return { meta: fresh, privateKey: await unwrapPrivateKey(vaultKey, fresh.protectedPrivateKey) }
  }
}
