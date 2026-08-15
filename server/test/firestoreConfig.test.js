import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRODUCTION_FIRESTORE_PROJECT_ID,
  resolveFirestoreProject
} from '../config/firestoreConfig.js'
import { db } from '../client/firestoreClient.js'
import { FirestoreSessionStore } from '../client/firestoreSessionStore.js'

test('non-production requires an explicit Firestore project', () => {
  assert.throws(
    () => resolveFirestoreProject({}),
    /FIRESTORE_PROJECT_ID=bakerrang-dev/
  )
  assert.throws(
    () => resolveFirestoreProject({ NODE_ENV: 'development' }),
    /required outside production/
  )
})

test('explicit development project resolves to bakerrang-dev', () => {
  assert.equal(
    resolveFirestoreProject({ FIRESTORE_PROJECT_ID: 'bakerrang-dev' }),
    'bakerrang-dev'
  )
})

test('production without an override retains the existing project', () => {
  assert.equal(
    resolveFirestoreProject({ NODE_ENV: 'production' }),
    PRODUCTION_FIRESTORE_PROJECT_ID
  )
  assert.equal(PRODUCTION_FIRESTORE_PROJECT_ID, 'avian-cable-379805')
})

test('production honors an explicit Firestore project override', () => {
  assert.equal(resolveFirestoreProject({
    NODE_ENV: 'production',
    FIRESTORE_PROJECT_ID: 'explicit-production-project'
  }), 'explicit-production-project')
})

test('session storage and application data use the same Firestore client', () => {
  const store = new FirestoreSessionStore()
  assert.equal(store.collection.firestore, db)
})
