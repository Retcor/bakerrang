import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createInternalLeadNotificationRouter } from '../routes/internalLeadNotifications.js'

test('internal lead notification drain requires its bearer token', async (t) => {
  const app = express()
  let calls = 0
  app.use('/internal', createInternalLeadNotificationRouter({
    env: { INTERNAL_DRAIN_TOKEN: 'scheduler-token' },
    drain: async () => { calls += 1; return { discovered: 0, claimed: 0, sent: 0, failed: 0 } }
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const url = `http://127.0.0.1:${server.address().port}/internal/lead-notifications/drain`
  const missing = await fetch(url, { method: 'POST' })
  assert.equal(missing.status, 401)
  const wrong = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer wrong-token' } })
  assert.equal(wrong.status, 401)
  const response = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer scheduler-token' } })
  assert.equal(response.status, 200)
  assert.equal(calls, 1)
})
