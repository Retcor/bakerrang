const keyFor = (id) => `sb.pos.${id}`

export const getReadingPosition = (id, storage = globalThis.localStorage) => {
  try {
    const value = Number.parseInt(storage.getItem(keyFor(id)), 10)
    return Number.isInteger(value) && value > 1 ? value : null
  } catch {
    return null
  }
}

export const setReadingPosition = (id, page, total, storage = globalThis.localStorage) => {
  try {
    if (page > 1 && page < total) storage.setItem(keyFor(id), String(page))
    else storage.removeItem(keyFor(id))
  } catch {}
}

export const clearReadingPosition = (id, storage = globalThis.localStorage) => {
  try { storage.removeItem(keyFor(id)) } catch {}
}
