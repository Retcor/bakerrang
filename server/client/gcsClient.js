import { Storage } from '@google-cloud/storage'
import { resolveMediaBucketName } from '../config/mediaConfig.js'

const storage = new Storage()

const bucket = () => storage.bucket(resolveMediaBucketName())

export const gcsStorage = {
  async putObject ({ objectName, bytes, contentType, cacheControl }) {
    await bucket().file(objectName).save(bytes, {
      resumable: false,
      metadata: { contentType, cacheControl },
      preconditionOpts: { ifGenerationMatch: 0 }
    })
  },

  async deleteObject (objectName) {
    await bucket().file(objectName).delete({ ignoreNotFound: true })
  },

  publicUrl (objectName) {
    const encodedPath = objectName.split('/').map(encodeURIComponent).join('/')
    return `https://storage.googleapis.com/${encodeURIComponent(resolveMediaBucketName())}/${encodedPath}`
  }
}
