import { db } from '../client/firestoreClient.js'

export const getLicenses = async userId => {
  const licenses = await db
    .collection('licenses')
    .doc(userId)
    .get()

  return licenses.data()?.licenses || []
}

export const postLicense = async (userId, licenses) => {
  const collection = db.collection('licenses')

  try {
    // Check if the record already exists
    const existingDoc = await collection.doc(userId).get()

    if (existingDoc.exists) {
      // Update the existing record
      await collection.doc(userId).update(licenses)
      console.log(`License record with ID ${userId} already exists. Updating with any new details.`)
    } else {
      // Store a new record
      await collection.doc(userId).set(licenses)
      console.log(`New license record with ID ${userId} stored successfully.`)
    }
  } catch (error) {
    console.error('Error checking or storing license record:', error)
  }

  return licenses
}
