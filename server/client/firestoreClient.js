import Firestore from '@google-cloud/firestore'

const db = new Firestore({
  projectId: 'avian-cable-379805'
})

export default db
