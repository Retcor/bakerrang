import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../app.js'

test('the retired sign-language interpretation endpoint returns 404', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sign-language/interpret`, { method: 'POST' })
    assert.equal(response.status, 404)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
