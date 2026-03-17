import { db } from '../client/firestoreClient.js'

const COLLECTION = 'budget'

export const getBudget = async (userId) => {
  const doc = await db.collection(COLLECTION).doc(userId).get()
  if (!doc.exists) {
    return { items: [], paydays: [] }
  }
  const data = doc.data()
  return {
    items: data.items || [],
    paydays: data.paydays || []
  }
}

export const saveItem = async (userId, item) => {
  const ref = db.collection(COLLECTION).doc(userId)
  const doc = await ref.get()

  if (!doc.exists) {
    await ref.set({ userId, items: [item], paydays: [] })
  } else {
    const items = doc.data().items || []
    const idx = items.findIndex(i => i.id === item.id)
    if (idx >= 0) {
      items[idx] = item
    } else {
      items.push(item)
    }
    await ref.update({ items })
  }
  return item
}

export const deleteItem = async (userId, itemId) => {
  const ref = db.collection(COLLECTION).doc(userId)
  const doc = await ref.get()
  if (!doc.exists) return

  const items = (doc.data().items || []).filter(i => i.id !== itemId)
  await ref.update({ items })
}

export const savePayday = async (userId, payday) => {
  const ref = db.collection(COLLECTION).doc(userId)
  const doc = await ref.get()

  if (!doc.exists) {
    await ref.set({ userId, items: [], paydays: [payday] })
  } else {
    const paydays = doc.data().paydays || []
    const idx = paydays.findIndex(p => p.id === payday.id)
    if (idx >= 0) {
      paydays[idx] = payday
    } else {
      paydays.push(payday)
    }
    await ref.update({ paydays })
  }
  return payday
}

export const deletePayday = async (userId, paydayId) => {
  const ref = db.collection(COLLECTION).doc(userId)
  const doc = await ref.get()
  if (!doc.exists) return

  const paydays = (doc.data().paydays || []).filter(p => p.id !== paydayId)
  await ref.update({ paydays })
}
