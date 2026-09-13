import { Readable } from 'node:stream'
const clone = (value) => value == null ? value : structuredClone(value)

export class FakeStorage {
  constructor () {
    this.puts = []
    this.deletes = []
    this.deletePrefixes = []
    this.objects = new Map()
    this.putError = null
    this.deleteError = null
    this.afterDeleteError = null
    this.deleteFilesError = null
  }

  async putObject (input) {
    this.puts.push(clone(input))
    if (this.putError) throw this.putError
    if (this.objects.has(input.objectName)) {
      throw Object.assign(new Error('Precondition failed'), { code: 412 })
    }
    this.objects.set(input.objectName, Buffer.from(input.bytes))
  }

  async deleteObject (objectName) {
    this.deletes.push(objectName)
    if (this.deleteError) throw this.deleteError
    this.objects.delete(objectName)
    if (this.afterDeleteError) throw this.afterDeleteError
  }

  async deleteFiles ({ prefix }) {
    this.deletePrefixes.push(prefix)
    if (this.deleteFilesError) throw this.deleteFilesError
    for (const objectName of [...this.objects.keys()]) {
      if (objectName.startsWith(prefix)) this.objects.delete(objectName)
    }
  }

  async getFiles ({ prefix } = {}) {
    return [...this.objects.keys()]
      .filter((objectName) => !prefix || objectName.startsWith(prefix))
      .map((name) => ({ name }))
  }

  publicUrl (objectName) {
    return `https://media.test/${objectName}`
  }

  createReadStream (objectName) {
    const bytes = this.objects.get(objectName)
    if (!bytes) throw new Error('Object not found')
    return Readable.from(bytes)
  }
}
