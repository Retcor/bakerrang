import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('Budget client privacy and responsive contract', () => {
  it('does not persist private plan data in browser storage or put it in query strings', () => {
    const sources = ['App.jsx', 'state/usePlan.js', 'api/budget.js'].map(read).join('\n')
    expect(sources).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    expect(read('api/budget.js')).not.toMatch(/\/budget\/[^'"`]*\?/)
  })

  it('keeps the locked mobile, sticky-action, and reduced-motion rules', () => {
    const css = read('styles/budget.css')
    expect(css).toMatch(/@media \(max-width: 640px\)/)
    expect(css).toMatch(/\.bd-add-menu \{ position: fixed/)
    expect(css).toMatch(/\.bd-statement \{ bottom: calc\(52px/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
