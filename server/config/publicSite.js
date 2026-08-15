export const draftPreviewEnabled = (env = process.env) =>
  env.NODE_ENV !== 'production' && env.ALLOW_DRAFT_PUBLIC_SITES === 'true'
