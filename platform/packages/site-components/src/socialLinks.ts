export function isSafeSocialUrl (value: unknown): value is string {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname)
  } catch {
    return false
  }
}
