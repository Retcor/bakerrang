import { db } from '../client/firestoreClient.js'

export const getStorybooks = async (userId) => {
  const snap = await db.collection('storybooks').where('userId', '==', userId).get()
  return snap.docs.map(d => d.data())
}

export const saveStorybook = async (userId, story) => {
  await db.collection('storybooks').doc(story.id).set({ ...story, userId })
  return story
}

export const deleteStorybook = async (userId, id) => {
  const doc = await db.collection('storybooks').doc(id).get()
  if (doc.exists && doc.data().userId === userId) {
    await db.collection('storybooks').doc(id).delete()
  }
}
