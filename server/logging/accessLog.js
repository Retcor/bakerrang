export const sanitizeLogUrl = (raw) => {
  const value = String(raw || '')
  const queryIndex = value.indexOf('?')
  const path = (queryIndex === -1 ? value : value.slice(0, queryIndex))
    .replace(/^(\/text\/to\/speech\/v1\/speech\/)[^/?#]+/, '$1:token')
    .slice(0, 200)

  if (queryIndex === -1) return path
  const keys = [...new Set([...new URLSearchParams(value.slice(queryIndex + 1)).keys()])]
    .slice(0, 10)
    .map((key) => `${encodeURIComponent(key.slice(0, 40))}=[redacted]`)
  return keys.length ? `${path}?${keys.join('&')}` : path
}
