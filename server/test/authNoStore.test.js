import assert from 'node:assert/strict'
import test from 'node:test'
import cookieParser from 'cookie-parser'
import express from 'express'
import authRouter from '../routes/auth.js'

const listen = async (signedIn) => {
  const app = express()
  app.use(cookieParser())
  app.use((req, res, next) => {
    req.sessionID = 'session-1'
    req.isAuthenticated = () => signedIn
    req.user = signedIn ? { id: 'u1', displayName: 'Sam Example', email: 'sam@example.test' } : undefined
    next()
  })
  app.use('/auth', authRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))

test('/auth/check carries no-store for signed-in and signed-out responses, with an unchanged shape', async () => {
  const signedIn = await listen(true)
  const signedOut = await listen(false)
  try {
    const ok = await fetch(`${signedIn.url}/auth/check`)
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await ok.json(), { isAuthenticated: true, user: { id: 'u1', displayName: 'Sam Example', email: 'sam@example.test' } })
    const denied = await fetch(`${signedOut.url}/auth/check`)
    assert.equal(denied.status, 401)
    assert.equal(denied.headers.get('cache-control'), 'no-store')
  } finally {
    await Promise.all([close(signedIn.server), close(signedOut.server)])
  }
})

test('/auth/csrf carries no-store and still issues a token', async () => {
  const { server, url } = await listen(true)
  try {
    const response = await fetch(`${url}/auth/csrf`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(typeof (await response.json()).csrfToken, 'string')
  } finally {
    await close(server)
  }
})
