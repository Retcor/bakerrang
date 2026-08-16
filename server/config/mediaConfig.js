export const resolveMediaBucketName = (env = process.env) => {
  const value = env.MEDIA_BUCKET_NAME
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('MEDIA_BUCKET_NAME is required')
  }
  return value.trim()
}
