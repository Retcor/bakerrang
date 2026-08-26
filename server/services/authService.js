import { db } from '../client/firestoreClient.js'

export const checkAndStoreUser = async (user, firestore = db) => {
  const collection = firestore.collection('users')
  // Normalized email for reliable case-insensitive lookup (used by vault sharing).
  // Only Google-managed profile fields belong in this sync. Privileged/internal
  // fields such as platformRole must never be accepted from the profile or
  // erased when a user signs in.
  const record = {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    emailLower: (user.email || '').trim().toLowerCase(),
    photo: user.photo
  }

  try {
    await collection.doc(user.id).set(record, { merge: true })
    console.log(`User record with ID ${user.id} synchronized successfully.`)
  } catch (error) {
    console.error('Error checking or storing user record:', error)
  }
}
