import Firestore from '@google-cloud/firestore'

export const db = new Firestore({
  projectId: 'avian-cable-379805'
})

export const userCanAccess = async (userId, recordId, collection) => {
  const query = db
    .collection(collection)
    .where('userId', '==', userId)
    .where('id', '==', recordId)
  const snapshot = await query.get()

  return snapshot.size > 0
}
