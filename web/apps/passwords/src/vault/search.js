const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export const searchEntries = (entries, query) => {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return entries
  return entries.filter((entry) => {
    const haystack = normalize(`${entry.title}\n${entry.username}\n${entry.url}`)
    return tokens.every((token) => haystack.includes(token))
  })
}
