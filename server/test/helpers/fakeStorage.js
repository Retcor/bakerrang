const clone = (value) => value == null ? value : structuredClone(value)

export class FakeStorage {
  constructor () {
    this.puts = []
    this.deletes = []
    this.objects = new Map()
    this.putError = null
    this.deleteError = null
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
  }

  publicUrl (objectName) {
    return `https://media.test/${objectName}`
  }
}
