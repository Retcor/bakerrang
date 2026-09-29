// Dependency-free so both the legacy provider and Phase G race tests use the
// same reconciliation path. A generated losing pair is never posted again.
export const ensureKeypairWith = async ({ meta, vaultKey, createKeyPair, unwrapPrivateKey, postKeys, getMeta }) => {
  if (meta.publicKey && meta.protectedPrivateKey) {
    return { meta, privateKey: await unwrapPrivateKey(vaultKey, meta.protectedPrivateKey) }
  }

  const generated = await createKeyPair(vaultKey)
  const result = await postKeys(generated)
  if (result.status === 200) {
    const next = { ...meta, ...generated }
    return { meta: next, privateKey: await unwrapPrivateKey(vaultKey, generated.protectedPrivateKey) }
  }
  if (result.status === 409 && result.body?.code === 'keys_exist') {
    const fresh = await getMeta()
    if (!fresh.publicKey || !fresh.protectedPrivateKey) throw new Error('Sharing keys unavailable')
    return { meta: fresh, privateKey: await unwrapPrivateKey(vaultKey, fresh.protectedPrivateKey) }
  }
  throw new Error(result.body?.error || 'Sharing keys unavailable')
}
