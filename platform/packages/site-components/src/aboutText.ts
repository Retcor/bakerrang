export function aboutParagraphs (body: string): string[] {
  if (typeof body !== 'string') return []
  return body
    .split(/(?:\r?\n)[\t ]*(?:\r?\n)+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
