import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFirestoreProject } from '../config/firestoreConfig.js'
import { db } from '../client/firestoreClient.js'
import { FirestoreSessionStore } from '../client/firestoreSessionStore.js'

test('every environment requires an explicit Firestore project', () => {
  for (const NODE_ENV of [undefined, 'development', 'test', 'production']) {
    assert.throws(
      () => resolveFirestoreProject({ NODE_ENV }),
      /FIRESTORE_PROJECT_ID is required\. Set it explicitly/
    )
  }
  assert.throws(
    () => resolveFirestoreProject({ FIRESTORE_PROJECT_ID: '   ' }),
    /FIRESTORE_PROJECT_ID is required/
  )
})

test('explicit development project resolves to bakerrang-dev', () => {
  assert.equal(
    resolveFirestoreProject({ FIRESTORE_PROJECT_ID: 'bakerrang-dev' }),
    'bakerrang-dev'
  )
})

test('production honors an explicit Firestore project', () => {
  assert.equal(resolveFirestoreProject({
    NODE_ENV: 'production',
    FIRESTORE_PROJECT_ID: 'explicit-production-project'
  }), 'explicit-production-project')
})

test('Firestore project values are normalized without consulting discovery variables', () => {
  assert.equal(resolveFirestoreProject({
    FIRESTORE_PROJECT_ID: ' explicit-project ',
    GOOGLE_CLOUD_PROJECT: 'discovered-project',
    GCLOUD_PROJECT: 'legacy-project'
  }), 'explicit-project')
  assert.throws(
    () => resolveFirestoreProject({ GOOGLE_CLOUD_PROJECT: 'discovered-project' }),
    /FIRESTORE_PROJECT_ID is required/
  )
})

test('session storage and application data use the same Firestore client', () => {
  const store = new FirestoreSessionStore()
  assert.equal(store.collection.firestore, db)
})
