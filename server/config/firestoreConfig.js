export const resolveFirestoreProject = (env = process.env) => {
  const value = env.FIRESTORE_PROJECT_ID
  if (typeof value === 'string' && value.trim()) return value.trim()

  throw new Error('FIRESTORE_PROJECT_ID is required. Set it explicitly for this environment.')
}
