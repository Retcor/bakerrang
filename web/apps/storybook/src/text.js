export const splitPages = (text) => String(text || '').split('\n').map((page) => page.trim()).filter(Boolean)

export const cleanStoryText = (text) => String(text || '')
  .replace(/^\s*#{1,6}\s+/, '')
  .replace(/\*\*|__|\*|_/g, '')
  .trim()

export const deriveTitle = (idea) => {
  const normalized = String(idea || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return 'Untitled story'
  const capitalized = normalized[0].toUpperCase() + normalized.slice(1)
  if (capitalized.length <= 80) return capitalized
  const slice = capitalized.slice(0, 80)
  const boundary = slice.lastIndexOf(' ')
  return (boundary > 0 ? slice.slice(0, boundary) : slice).trim()
}

export const chunkText = (text, maxLength = 220) => {
  const sentences = cleanStoryText(text).match(/[^.!?]+[.!?”]*\s*/g) || [cleanStoryText(text)]
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current + sentence).length > maxLength) {
      chunks.push(current.trim())
      current = sentence
    } else current += sentence
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
