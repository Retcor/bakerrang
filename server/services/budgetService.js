import { randomUUID } from 'node:crypto'
import { db } from '../client/firestoreClient.js'
import { MAX_BILLS, MAX_PAYDAYS, SERVER_OWNED_FIELDS, billToStored, normalizeBill, normalizePayday, normalizePlan, paydayToStored, stripServerOwned, validateBill, validatePayday } from '../domain/budgetPlan.js'

const COLLECTION = 'budget'
let firestore = db

export const _setDb = (nextDb) => { firestore = nextDb || db }

const failure = (status, error, extra = {}) => Object.assign(new Error(error), { status, response: { error, ...extra } })
const arrays = (data = {}) => ({ items: Array.isArray(data.items) ? data.items : [], paydays: Array.isArray(data.paydays) ? data.paydays : [] })
const refFor = (userId) => firestore.collection(COLLECTION).doc(userId)
const normalizedByKind = (kind, stored, paydays) => kind === 'payday' ? normalizePayday(stored) : normalizeBill(stored, new Set(paydays.map(({ id }) => id)))

export const getBudget = async (userId) => {
  const doc = await refFor(userId).get()
  return doc.exists ? arrays(doc.data()) : { items: [], paydays: [] }
}

export const getPlan = async (userId) => {
  const doc = await refFor(userId).get()
  return normalizePlan(doc.exists ? doc.data() : {})
}

const createEntry = async (userId, kind, body) => firestore.runTransaction(async (transaction) => {
  const ref = refFor(userId)
  const snapshot = await transaction.get(ref)
  const data = arrays(snapshot.exists ? snapshot.data() : {})
  const listName = kind === 'payday' ? 'paydays' : 'items'
  const list = data[listName]
  const validation = kind === 'payday'
    ? validatePayday(body, { create: true })
    : validateBill(body, new Set(data.paydays.map(({ id }) => id)), { create: true })
  if (!validation.ok) throw failure(400, validation.error, { field: validation.field })
  if (body.requestId) {
    const existing = list.find((entry) => entry.requestId === body.requestId)
    if (existing) return { status: 200, entry: normalizedByKind(kind, existing, data.paydays) }
  }
  const limit = kind === 'payday' ? MAX_PAYDAYS : MAX_BILLS
  if (list.length >= limit) throw failure(409, `${kind === 'payday' ? 'Payday' : 'Bill'} limit reached`, { code: 'limit', limit })
  const id = randomUUID()
  const mapped = kind === 'payday' ? paydayToStored(validation.value) : billToStored(validation.value)
  const stored = { ...mapped, id, rev: 1, ...(body.requestId ? { requestId: body.requestId } : {}) }
  const next = [...list, stored]
  transaction.set(ref, { userId, items: listName === 'items' ? next : data.items, paydays: listName === 'paydays' ? next : data.paydays }, { merge: true })
  return { status: 201, entry: normalizedByKind(kind, stored, listName === 'paydays' ? next : data.paydays) }
})

const updateEntry = async (userId, kind, id, body) => firestore.runTransaction(async (transaction) => {
  const ref = refFor(userId)
  const snapshot = await transaction.get(ref)
  const data = arrays(snapshot.exists ? snapshot.data() : {})
  const listName = kind === 'payday' ? 'paydays' : 'items'
  const list = data[listName]
  const index = list.findIndex((entry) => entry.id === id)
  const label = kind === 'payday' ? 'Payday' : 'Bill'
  if (index < 0) throw failure(404, `${label} not found`)
  const current = list[index]
  const validation = kind === 'payday'
    ? validatePayday(body, { create: false })
    : validateBill(body, new Set(data.paydays.map(({ id }) => id)), { create: false })
  if (!validation.ok) throw failure(400, validation.error, { field: validation.field })
  if (kind === 'bill' && validation.value.category !== current.category) throw failure(400, 'Invalid bill', { field: 'category' })
  const currentRev = Number.isInteger(current.rev) && current.rev >= 0 ? current.rev : 0
  if (currentRev !== validation.value.expectedRev) throw failure(409, `${label} changed`, { code: 'conflict', current: normalizedByKind(kind, current, data.paydays) })
  const mapped = kind === 'payday' ? paydayToStored(validation.value) : billToStored(validation.value)
  const stored = { ...current, ...mapped, id, rev: currentRev + 1 }
  const next = [...list]
  next[index] = stored
  transaction.set(ref, { userId, items: listName === 'items' ? next : data.items, paydays: listName === 'paydays' ? next : data.paydays }, { merge: true })
  return normalizedByKind(kind, stored, listName === 'paydays' ? next : data.paydays)
})

const deleteEntry = async (userId, kind, id) => firestore.runTransaction(async (transaction) => {
  const ref = refFor(userId)
  const snapshot = await transaction.get(ref)
  const data = arrays(snapshot.exists ? snapshot.data() : {})
  const listName = kind === 'payday' ? 'paydays' : 'items'
  const list = data[listName]
  const index = list.findIndex((entry) => entry.id === id)
  const label = kind === 'payday' ? 'Payday' : 'Bill'
  if (index < 0) throw failure(404, `${label} not found`)
  const next = list.filter((entry) => entry.id !== id)
  let items = data.items
  const unpinned = []
  if (kind === 'payday') {
    items = data.items.map((bill) => {
      if (bill.paydayId !== id) return bill
      const updated = { ...bill, paydayId: null, rev: (Number.isInteger(bill.rev) && bill.rev >= 0 ? bill.rev : 0) + 1 }
      unpinned.push({ id: String(updated.id || ''), rev: updated.rev })
      return updated
    })
  }
  transaction.set(ref, { userId, items: listName === 'items' ? next : items, paydays: listName === 'paydays' ? next : data.paydays }, { merge: true })
  return kind === 'payday' ? { deleted: true, unpinned } : { deleted: true }
})

export const createPayday = (userId, body) => createEntry(userId, 'payday', body)
export const createBill = (userId, body) => createEntry(userId, 'bill', body)
export const updatePayday = (userId, id, body) => updateEntry(userId, 'payday', id, body)
export const updateBill = (userId, id, body) => updateEntry(userId, 'bill', id, body)
export const deleteNewPayday = (userId, id) => deleteEntry(userId, 'payday', id)
export const deleteBill = (userId, id) => deleteEntry(userId, 'bill', id)

const saveLegacy = async (userId, listName, body) => firestore.runTransaction(async (transaction) => {
  const ref = refFor(userId)
  const snapshot = await transaction.get(ref)
  const data = arrays(snapshot.exists ? snapshot.data() : {})
  const list = data[listName]
  const clean = stripServerOwned(body)
  const index = list.findIndex((entry) => entry.id === body?.id)
  const next = [...list]
  if (index >= 0) {
    const existing = list[index]
    const serverOwned = Object.fromEntries(SERVER_OWNED_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(existing, field)).map((field) => [field, existing[field]]))
    next[index] = { ...clean, ...serverOwned, rev: (Number.isInteger(existing.rev) && existing.rev >= 0 ? existing.rev : 0) + 1 }
  } else {
    next.push({ ...clean, rev: 1 })
  }
  transaction.set(ref, { userId, items: listName === 'items' ? next : data.items, paydays: listName === 'paydays' ? next : data.paydays }, { merge: true })
  return body
})

const deleteLegacy = async (userId, listName, id) => firestore.runTransaction(async (transaction) => {
  const ref = refFor(userId)
  const snapshot = await transaction.get(ref)
  if (!snapshot.exists) return
  const data = arrays(snapshot.data())
  const next = data[listName].filter((entry) => entry.id !== id)
  transaction.set(ref, { userId, items: listName === 'items' ? next : data.items, paydays: listName === 'paydays' ? next : data.paydays }, { merge: true })
})

export const saveItem = (userId, item) => saveLegacy(userId, 'items', item)
export const savePayday = (userId, payday) => saveLegacy(userId, 'paydays', payday)
export const deleteItem = (userId, id) => deleteLegacy(userId, 'items', id)
export const deletePayday = (userId, id) => deleteLegacy(userId, 'paydays', id)
