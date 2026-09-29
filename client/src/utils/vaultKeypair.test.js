import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureKeypairWith } from './vaultKeypair.js'

const harness = () => {
  let persisted = { id: 'vault' }
  let writes = 0
  const unwrapPrivateKey = async (_key, wrapped) => `private:${wrapped}`
  const client = (name) => ensureKeypairWith({
    meta: { id: 'vault' },
    vaultKey: 'vault-key',
    createKeyPair: async () => ({ publicKey: `public:${name}`, protectedPrivateKey: `wrapped:${name}` }),
    unwrapPrivateKey,
    postKeys: async (pair) => {
      if (persisted.publicKey) return { status: 409, body: { code: 'keys_exist' } }
      writes++
      persisted = { ...persisted, ...pair }
      return { status: 200, body: persisted }
    },
    getMeta: async () => persisted
  })
  return { client, persisted: () => persisted, writes: () => writes }
}

test('a losing legacy client reconciles to the persisted sharing keypair', async () => {
  const state = harness()
  const first = await state.client('new')
  const second = await state.client('legacy')
  assert.equal(state.writes(), 1)
  assert.deepEqual(second.meta, state.persisted())
  assert.equal(first.privateKey, second.privateKey)
})

test('two legacy clients use one persisted pair after the set-once conflict', async () => {
  const state = harness()
  const clients = await Promise.all([state.client('legacy-a'), state.client('legacy-b')])
  assert.equal(state.writes(), 1)
  assert.equal(clients[0].privateKey, clients[1].privateKey)
  assert.deepEqual(clients[0].meta, state.persisted())
  assert.deepEqual(clients[1].meta, state.persisted())
})
