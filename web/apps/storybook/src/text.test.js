import { describe, expect, it } from 'vitest'
import { chunkText, cleanStoryText, deriveTitle, splitPages } from './text.js'

describe('story text helpers', () => {
  it('splits generated pages and strips simple markdown', () => {
    expect(splitPages(' First page.\n\nSecond page. ')).toEqual(['First page.', 'Second page.'])
    expect(cleanStoryText('## **A bright** _night_.')).toBe('A bright night.')
  })

  it('derives a bounded title and narration chunks', () => {
    expect(deriveTitle('  a lighthouse learns to sing  ')).toBe('A lighthouse learns to sing')
    expect(deriveTitle('x'.repeat(100))).toHaveLength(80)
    expect(chunkText('One short sentence. Another short sentence.', 25)).toEqual(['One short sentence.', 'Another short sentence.'])
  })
})
