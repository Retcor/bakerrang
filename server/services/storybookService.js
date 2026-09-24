import { db } from '../client/firestoreClient.js'

const STORIES = 'storybooks'
const STORY_ID = /^[A-Za-z0-9-]{1,64}$/
let firestore = db

export const _setDb = (nextDb) => {
  firestore = nextDb || db
}

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const invalid = (message) => {
  throw httpError(400, message)
}

const validateTitle = (value) => {
  if (typeof value !== 'string' || !value.trim()) invalid('Story title is required')
  const title = value.trim()
  if (title.length > 120) invalid('Story title must be 120 characters or fewer')
  return title
}

const validateStory = (input) => {
  const story = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (typeof story.id !== 'string' || !STORY_ID.test(story.id)) invalid('Story id is invalid')
  const title = validateTitle(story.title)
  if (typeof story.prompt !== 'string' || story.prompt.length > 1000) invalid('Story prompt is invalid')
  if (typeof story.createdAt !== 'string') invalid('Story createdAt is invalid')
  if (story.thumbnail !== null && typeof story.thumbnail !== 'string') invalid('Story thumbnail is invalid')
  if (!Array.isArray(story.pages) || story.pages.length < 1 || story.pages.length > 20) invalid('Story pages are invalid')

  const pages = story.pages.map((page) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) invalid('Story page is invalid')
    if (typeof page.reply !== 'string' || page.reply.length > 5000) invalid('Story page text is invalid')
    if (page.image !== null && typeof page.image !== 'string') invalid('Story page image is invalid')
    return { reply: page.reply, image: page.image }
  })

  return {
    id: story.id,
    title,
    prompt: story.prompt,
    createdAt: story.createdAt,
    thumbnail: story.thumbnail,
    pages
  }
}

const cleanFormatting = (value) => String(value || '')
  .replace(/^\s*#{1,6}\s+[^\n]*(?:\n+|$)/, '')
  .replace(/\*\*|__|\*|_/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const capExcerpt = (value) => {
  if (value.length <= 160) return value
  const slice = value.slice(0, 159)
  const boundary = slice.lastIndexOf(' ')
  return `${(boundary > 0 ? slice.slice(0, boundary) : slice).trim()}…`
}

export const storySummary = (value = {}, fallbackId = '') => {
  const pages = Array.isArray(value.pages) ? value.pages : []
  const first = typeof pages[0]?.reply === 'string' ? cleanFormatting(pages[0].reply) : ''
  const sentence = first.match(/^.*?[.!?](?:["'”’)}\]]+)?(?=\s|$)/)?.[0] || first
  const title = typeof value.title === 'string' && value.title.trim()
    ? value.title.trim()
    : 'Untitled story'
  return {
    id: typeof value.id === 'string' && value.id ? value.id : fallbackId,
    title,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    pageCount: pages.length,
    excerpt: capExcerpt(sentence),
    thumbnail: typeof value.thumbnail === 'string' && value.thumbnail ? value.thumbnail : null
  }
}

const ownedSnapshot = (snapshot, userId) => {
  if (!snapshot.exists || snapshot.data()?.userId !== userId) {
    throw httpError(404, 'Story not found')
  }
  return snapshot
}

export const getStorybooks = async (userId, { summary = false } = {}) => {
  const snap = await firestore.collection(STORIES).where('userId', '==', userId).get()
  const stories = snap.docs.map((document) => ({ document, value: document.data() }))
  if (!summary) return stories.map(({ value }) => value)
  return stories
    .map(({ document, value }) => storySummary(value, document.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id))
}

export const getStorybook = async (userId, id) => {
  const snapshot = ownedSnapshot(await firestore.collection(STORIES).doc(id).get(), userId)
  return snapshot.data()
}

export const saveStorybook = async (userId, input) => {
  const story = validateStory(input)
  const ref = firestore.collection(STORIES).doc(story.id)
  try {
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref)
      if (snapshot.exists && snapshot.data()?.userId !== userId) {
        throw httpError(404, 'Story not found')
      }
      transaction.set(ref, { ...story, userId })
    })
  } catch (error) {
    if (error.status === 404) throw error
    if (error.code === 3 || error.code === 'invalid-argument' || /too large|maximum.*size|invalid argument/i.test(error.message || '')) {
      throw httpError(413, 'Story is too large to save')
    }
    throw error
  }
  return story
}

export const renameStorybook = async (userId, id, input) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  if (Object.keys(body).some((key) => key !== 'title')) invalid('Only the story title can be changed')
  const title = validateTitle(body.title)
  const ref = firestore.collection(STORIES).doc(id)
  let summary
  await firestore.runTransaction(async (transaction) => {
    const snapshot = ownedSnapshot(await transaction.get(ref), userId)
    transaction.set(ref, { title }, { merge: true })
    summary = storySummary({ ...snapshot.data(), title }, snapshot.id)
  })
  return summary
}

export const deleteStorybook = async (userId, id) => {
  const ref = firestore.collection(STORIES).doc(id)
  await firestore.runTransaction(async (transaction) => {
    ownedSnapshot(await transaction.get(ref), userId)
    transaction.delete(ref)
  })
}
