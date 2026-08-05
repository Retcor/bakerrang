// Vault entry URLs are free text: they may lack a scheme, include a path, or be
// blank. We reduce both the entry URL and the tab URL to a bare hostname and
// match on a dot-boundary suffix so an entry saved as `example.com` also fills
// `login.example.com` (and vice-versa) without matching `notexample.com`.

export const normalizeHost = (raw) => {
  if (!raw || typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s) return null
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    let host = u.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    return host || null
  } catch {
    return null
  }
}

// True when `host` equals `base` or is a sub/parent domain of it, on a dot
// boundary. Both directions so an entry on the apex matches a subdomain tab and
// an entry on a subdomain matches the apex tab.
const isRelatedDomain = (host, base) =>
  host === base || host.endsWith('.' + base) || base.endsWith('.' + host)

// Returns the matching entries, exact-host matches first.
export const entriesForTab = (tabHost, entries) => {
  if (!tabHost) return []
  const scored = []
  for (const entry of entries) {
    const entryHost = normalizeHost(entry.url)
    if (!entryHost) continue
    if (entryHost === tabHost) scored.push({ entry, rank: 0 })
    else if (isRelatedDomain(tabHost, entryHost)) scored.push({ entry, rank: 1 })
  }
  scored.sort((a, b) => a.rank - b.rank)
  return scored.map((s) => s.entry)
}
