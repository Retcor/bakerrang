import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveMediaBucketName } from '../config/mediaConfig.js'

test('media bucket configuration requires an explicit bucket name', () => {
  assert.throws(() => resolveMediaBucketName({}), /MEDIA_BUCKET_NAME is required/)
  assert.throws(() => resolveMediaBucketName({ MEDIA_BUCKET_NAME: '   ' }), /MEDIA_BUCKET_NAME is required/)
})

test('media bucket configuration trims the configured name without a fallback', () => {
  assert.equal(resolveMediaBucketName({ MEDIA_BUCKET_NAME: ' dev-media-bucket ' }), 'dev-media-bucket')
})
