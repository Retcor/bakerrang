import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createPublicSiteRouter } from '../routes/publicSites.js'

let server
let baseUrl

const definition = {
  status: 'PUBLISHED',
  pages: [{
    id: 'home',
    slug: '/',
    title: 'Home',
    sections: [{ id: 'hero', type: 'hero', content: { title: 'Public Site' } }]
  }]
}

const notFound = () => Object.assign(new Error('Site not found'), { status: 404 })

before(async () => {
  const app = express()
  app.use('/public', createPublicSiteRouter({
    siteService: {
      getPublicSite: async (tenantId) => {
        if (tenantId === 'missing') throw notFound()
        return definition
      },
      getPublishedSiteDefinition: async (tenantId) => {
        if (tenantId === 'missing') throw notFound()
        return definition
      }
    },
    siteDomainService: {
      resolveActiveDomain: async (hostname) => {
        if (hostname !== 'active.example') throw notFound()
        return { tenantId: 'tenant-1', canonicalHost: 'active.example' }
      },
      getActiveDomainForTenant: async (tenantId) => ({
        canonicalHost: tenantId === 'tenant-1' ? 'active.example' : null
      })
    }
  }))
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('public site route succeeds without a user or authenticated session', async () => {
  const response = await fetch(`${baseUrl}/public/sites/tenant-1`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), definition)
})

test('public site route maps a normalized service 404', async () => {
  const response = await fetch(`${baseUrl}/public/sites/missing`)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'Site not found' })
})

test('published-only site route is anonymous, explicit, and maps missing snapshots to 404', async () => {
  const published = await fetch(`${baseUrl}/public/sites/tenant-1/published`)
  assert.equal(published.status, 200)
  assert.deepEqual(await published.json(), definition)

  const missing = await fetch(`${baseUrl}/public/sites/missing/published`)
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: 'Site not found' })
})

test('public domain routes return only sanitized routing facts', async () => {
  const active = await fetch(`${baseUrl}/public/domains/active.example`)
  assert.equal(active.status, 200)
  assert.deepEqual(await active.json(), { tenantId: 'tenant-1', canonicalHost: 'active.example' })
  assert.equal((await fetch(`${baseUrl}/public/domains/pending.example`)).status, 404)

  assert.deepEqual(await (await fetch(`${baseUrl}/public/sites/tenant-1/domain`)).json(), {
    canonicalHost: 'active.example'
  })
  assert.deepEqual(await (await fetch(`${baseUrl}/public/sites/tenant-2/domain`)).json(), {
    canonicalHost: null
  })
})
