const clone = (value) => value == null ? value : structuredClone(value)

class FakeDocumentSnapshot {
  constructor (ref, value) {
    this.id = ref.id
    this.ref = ref
    this.exists = value !== undefined
    this.value = clone(value)
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

  async delete () {
    this.database.remove(this.path)
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

  where (field, operator, value) {
    return new FakeQuery(this.database, this.path).where(field, operator, value)
  }

  orderBy (field, direction) {
    return new FakeQuery(this.database, this.path).orderBy(field, direction)
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
  constructor (database, path, order = [], max = null, filters = [], after = null) {
    this.database = database
    this.path = path
    this.order = order
    // Compatibility for existing test hooks; queries may now have more than
    // one ordering field, with the final field retained here for inspection.
    this.orderField = order.at(-1)?.field
    this.direction = order.at(-1)?.direction
    this.max = max
    this.filters = filters
    this.after = after
  }

  where (field, operator, value) {
    if (operator !== '==') throw new Error('FakeQuery supports equality only')
    return new FakeQuery(this.database, this.path, this.order, this.max, [...this.filters, { field, value }], this.after)
  }

  orderBy (field, direction = 'asc') {
    return new FakeQuery(this.database, this.path, [...this.order, { field, direction }], this.max, this.filters, this.after)
  }

  limit (max) {
    return new FakeQuery(this.database, this.path, this.order, max, this.filters, this.after)
  }

  startAfter (...values) {
    if (values.length !== this.order.length) throw new Error('FakeQuery cursor does not match order')
    return new FakeQuery(this.database, this.path, this.order, this.max, this.filters, values)
  }

  async get () {
    const depth = this.path.split('/').length + 1
    let entries = [...this.database.records.entries()]
      .filter(([path, value]) =>
        path.startsWith(`${this.path}/`) &&
        path.split('/').length === depth &&
        (!this.order.length || this.order.every(({ field }) => Object.prototype.hasOwnProperty.call(value, field))) &&
        this.filters.every((filter) => filter.field.split('.').reduce((v, key) => v?.[key], value) === filter.value)
      )
      .sort(([, left], [, right]) => this.order.reduce((result, { field, direction }) => {
        if (result) return result
        const comparison = left[field] < right[field] ? -1 : left[field] > right[field] ? 1 : 0
        return direction === 'desc' ? -comparison : comparison
      }, 0))
    if (this.after) {
      entries = entries.filter(([, value]) => this.order.some(({ field, direction }, index) => {
        for (let prior = 0; prior < index; prior++) {
          if (value[this.order[prior].field] !== this.after[prior]) return false
        }
        return direction === 'desc' ? value[field] < this.after[index] : value[field] > this.after[index]
      }))
    }
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
    this.versions = new Map()
    this.beforeCommit = null
    this.beforeTransactionSet = null
    this.afterCommit = null
    this.maxAttempts = 5
    this.transactionAttempts = 0
  }

  collection (name) {
    return new FakeCollectionReference(this, name)
  }

  async getAll (...refs) {
    return Promise.all(refs.map((ref) => ref.get()))
  }

  seed (path, value) {
    this.write(path, value)
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
    this.versions.set(path, (this.versions.get(path) || 0) + 1)
  }

  remove (path) {
    this.records.delete(path)
    this.versions.set(path, (this.versions.get(path) || 0) + 1)
  }

  async runTransaction (callback) {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      this.transactionAttempts++
      const reads = new Map()
      const writes = []
      const get = async (ref) => {
        if (writes.length) throw new Error('Transaction reads must precede writes')
        if (!reads.has(ref.path)) reads.set(ref.path, this.versions.get(ref.path) || 0)
        return ref.get()
      }
      const transaction = {
        get,
        getAll: (...refs) => Promise.all(refs.map(get)),
        set: (ref, value, options) => {
          if (this.beforeTransactionSet) this.beforeTransactionSet({ ref, value })
          writes.push({ type: 'set', ref, value: clone(value), options })
        },
        delete: (ref) => writes.push({ type: 'delete', ref })
      }
      const result = await callback(transaction)
      if (this.beforeCommit) await this.beforeCommit({ attempt, reads, writes })
      if ([...reads].some(([path, version]) => (this.versions.get(path) || 0) !== version)) continue
      // No await or hook between validation and application: atomic commit.
      for (const write of writes) {
        if (write.type === 'delete') this.remove(write.ref.path)
        else this.write(write.ref.path, write.value, write.options)
      }
      if (this.afterCommit) await this.afterCommit({ attempt, reads, writes })
      return result
    }
    throw Object.assign(new Error('Transaction contention exhausted retries'), { code: 10 })
  }
}
