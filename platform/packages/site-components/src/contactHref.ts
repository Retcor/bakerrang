const emailPattern = /^[A-Za-z0-9.!$%&'*+=^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

export function contactHref (action: unknown): string | null {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return null
  const candidate = action as { type?: unknown, value?: unknown }
  if (typeof candidate.value !== 'string') return null
  const value = candidate.value.trim()
  if (!value) return null

  if (candidate.type === 'email') {
    return value.length <= 254 && emailPattern.test(value) ? `mailto:${value}` : null
  }
  if (candidate.type === 'phone') {
    const dialValue = value.replace(/[()\-.\s]/g, '')
    return value.length <= 50 && /^\+?[\d()\-.\s]+$/.test(value) && /^\+?\d{7,15}$/.test(dialValue)
      ? `tel:${dialValue}`
      : null
  }
  if (candidate.type === 'url') {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? parsed.toString()
        : null
    } catch {
      return null
    }
  }
  return null
}
