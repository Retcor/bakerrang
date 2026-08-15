import Firestore from '@google-cloud/firestore'
import { resolveFirestoreProject } from '../config/firestoreConfig.js'

const projectId = resolveFirestoreProject()
export const db = new Firestore({
  projectId
})

console.log(`Firestore configuration:
  project: ${projectId}
  database: (default)`)

// Sentinel factory for atomic field ops (e.g. FieldValue.increment(1)).
export const FieldValue = Firestore.FieldValue

export const userCanAccess = async (userId, recordId, collection) => {
  const query = db
    .collection(collection)
    .where('userId', '==', userId)
    .where('id', '==', recordId)
  const snapshot = await query.get()

  return snapshot.size > 0
}
