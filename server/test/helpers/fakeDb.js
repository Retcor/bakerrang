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

  orderBy (field, direction) {
    return new FakeQuery(this.database, this.path, field, direction)
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

class FakeQuery {
  constructor (database, path, orderField, direction = 'asc', max = null) {
    this.database = database
    this.path = path
    this.orderField = orderField
    this.direction = direction
    this.max = max
  }

  limit (max) {
    return new FakeQuery(this.database, this.path, this.orderField, this.direction, max)
  }

  async get () {
    const depth = this.path.split('/').length + 1
    let entries = [...this.database.records.entries()]
      .filter(([path, value]) =>
        path.startsWith(`${this.path}/`) &&
        path.split('/').length === depth &&
        Object.prototype.hasOwnProperty.call(value, this.orderField)
      )
      .sort(([, left], [, right]) => {
        const comparison = left[this.orderField] < right[this.orderField]
          ? -1
          : left[this.orderField] > right[this.orderField] ? 1 : 0
        return this.direction === 'desc' ? -comparison : comparison
      })
    if (this.max !== null) entries = entries.slice(0, this.max)
    const docs = entries.map(([path, value]) => new FakeDocumentSnapshot(
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

  async getAll (...refs) {
    return Promise.all(refs.map((ref) => ref.get()))
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
      set: (ref, value, options) => writes.push({ type: 'set', ref, value, options }),
      delete: (ref) => writes.push({ type: 'delete', ref })
    }
    const result = await callback(transaction)
    for (const write of writes) {
      if (write.type === 'delete') this.records.delete(write.ref.path)
      else this.write(write.ref.path, write.value, write.options)
    }
    return result
  }
}
