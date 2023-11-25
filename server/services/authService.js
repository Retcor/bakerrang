import db from '../client/firestoreClient.js'

export const checkAndStoreUser = async user => {
  const collection = db.collection('users')

  try {
    // Check if the record already exists
    const existingDoc = await collection.doc(user.id).get()

    if (existingDoc.exists) {
      // Update the existing record
      await collection.doc(user.id).update(user)
      console.log(`Record with ID ${user.id} already exists. Updating with any new details.`)
    } else {
      // Store a new record
      await collection.doc(user.id).set(user)
      console.log(`New record with ID ${user.id} stored successfully.`)
    }
  } catch (error) {
    console.error('Error checking or storing record:', error)
  }
}
