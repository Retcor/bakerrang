const clone = (value) => value == null ? value : structuredClone(value)

class FakeDocumentSnapshot {
  constructor (ref, value) {
    this.id = ref.id
    this.ref = ref
    this.exists = value !== undefined
    this.value = value
  }

  data () {
    return clone(this.value)
  }
}

class FakeDocumentReference {
  constructor (database, path) {
    this.database = database
    this.path = path
    this.id = path.split('/').at(-1)
  }

  collection (name) {
    return new FakeCollectionReference(this.database, `${this.path}/${name}`)
  }

  async get () {
    return new FakeDocumentSnapshot(this, this.database.records.get(this.path))
  }

  async set (value, options = {}) {
    this.database.write(this.path, value, options)
  }
}

class FakeCollectionReference {
  constructor (database, path) {
    this.database = database
    this.path = path
  }

  doc (id) {
    return new FakeDocumentReference(this.database, `${this.path}/${id}`)
  }

  async get () {
    const depth = this.path.split('/').length + 1
    const docs = [...this.database.records.entries()]
      .filter(([path]) => path.startsWith(`${this.path}/`) && path.split('/').length === depth)
      .map(([path, value]) => new FakeDocumentSnapshot(
        new FakeDocumentReference(this.database, path),
        value
      ))
    return { docs, size: docs.length }
  }
}

export class FakeDb {
  constructor () {
    this.records = new Map()
  }

  collection (name) {
    return new FakeCollectionReference(this, name)
  }

  seed (path, value) {
    this.records.set(path, clone(value))
    return this
  }

  data (path) {
    return clone(this.records.get(path))
  }

  paths () {
    return [...this.records.keys()]
  }

  write (path, value, options = {}) {
    const existing = this.records.get(path)
    const next = options.merge && existing
      ? { ...existing, ...clone(value) }
      : clone(value)
    this.records.set(path, next)
  }

  async runTransaction (callback) {
    const writes = []
    const transaction = {
      get: (ref) => ref.get(),
      set: (ref, value, options) => writes.push({ ref, value, options })
    }
    const result = await callback(transaction)
    for (const write of writes) {
      this.write(write.ref.path, write.value, write.options)
    }
    return result
  }
}
