export const PRODUCTION_FIRESTORE_PROJECT_ID = 'avian-cable-379805'

export const resolveFirestoreProject = (env = process.env) => {
  if (env.FIRESTORE_PROJECT_ID) return env.FIRESTORE_PROJECT_ID

  if (env.NODE_ENV === 'production') {
    // TODO: Remove this compatibility fallback once Cloud Run configuration
    // is standardized and FIRESTORE_PROJECT_ID is explicitly deployed.
    return PRODUCTION_FIRESTORE_PROJECT_ID
  }

  throw new Error(
    'FIRESTORE_PROJECT_ID is required outside production. ' +
    'Set FIRESTORE_PROJECT_ID=bakerrang-dev so local development never touches production Firestore.'
  )
}
