import session from 'express-session'
import { db } from './firestoreClient.js'

const { Store } = session

const DEFAULT_COLLECTION = 'sessions'
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 1 day

// Minimal express-session Store backed by Firestore. Sessions survive server
// restarts and work across multiple instances (the default MemoryStore does
// neither). Only get/set/destroy/touch are required by express-session.
export class FirestoreSessionStore extends Store {
  constructor ({ collection = DEFAULT_COLLECTION, ttlMs = DEFAULT_TTL_MS } = {}) {
    super()
    this.collection = db.collection(collection)
    this.ttlMs = ttlMs
  }

  expiresFor (sess) {
    if (sess && sess.cookie && sess.cookie.expires) {
      return new Date(sess.cookie.expires).getTime()
    }
    return Date.now() + this.ttlMs
  }

  async get (sid, cb) {
    try {
      const doc = await this.collection.doc(sid).get()
      if (!doc.exists) return cb(null, null)
      const { data, expires } = doc.data()
      if (expires && Date.now() >= expires) {
        await this.collection.doc(sid).delete()
        return cb(null, null)
      }
      return cb(null, JSON.parse(data))
    } catch (err) {
      return cb(err)
    }
  }

  async set (sid, sess, cb = () => {}) {
    try {
      await this.collection.doc(sid).set({
        data: JSON.stringify(sess),
        expires: this.expiresFor(sess)
      })
      return cb(null)
    } catch (err) {
      return cb(err)
    }
  }

  async destroy (sid, cb = () => {}) {
    try {
      await this.collection.doc(sid).delete()
      return cb(null)
    } catch (err) {
      return cb(err)
    }
  }

  async touch (sid, sess, cb = () => {}) {
    try {
      await this.collection.doc(sid).set({ expires: this.expiresFor(sess) }, { merge: true })
      return cb(null)
    } catch (err) {
      return cb(err)
    }
  }
}
