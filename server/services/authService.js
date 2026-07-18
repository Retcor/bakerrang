import { db } from '../client/firestoreClient.js'

export const checkAndStoreUser = async user => {
  const collection = db.collection('users')
  // Normalized email for reliable case-insensitive lookup (used by vault sharing).
  const record = { ...user, emailLower: (user.email || '').trim().toLowerCase() }

  try {
    // Check if the record already exists
    const existingDoc = await collection.doc(user.id).get()

    if (existingDoc.exists) {
      // Update the existing record
      await collection.doc(user.id).update(record)
      console.log(`User record with ID ${user.id} already exists. Updating with any new details.`)
    } else {
      // Store a new record
      await collection.doc(user.id).set(record)
      console.log(`New user record with ID ${user.id} stored successfully.`)
    }
  } catch (error) {
    console.error('Error checking or storing user record:', error)
  }
}
