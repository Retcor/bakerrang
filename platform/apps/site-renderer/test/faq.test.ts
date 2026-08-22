import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

test('FAQ uses collapsed native disclosure markup and renders safe ordered plain text', async () => {
  const faq = await source('../../../packages/site-components/src/Faq.tsx')
  assert.match(faq, /<SiteSection className="bg-site-bg" id="faq">/)
  assert.match(faq, /<SiteContainer>/)
  assert.match(faq, /<SectionHeading>\{heading\}<\/SectionHeading>/)
  assert.match(faq, /\{intro && <p/)
  assert.match(faq, /items\.map\(\(item, index\) =>/)
  assert.match(faq, /<details className=/)
  assert.match(faq, /<summary className=/)
  assert.doesNotMatch(faq, /<details[^>]*\sopen(?:=|\s|>)/)
  assert.doesNotMatch(faq, /<summary[^>]*>[\s\S]*<button|dangerouslySetInnerHTML|Markdown/)
  assert.match(faq, /whitespace-pre-line/)
})

test('FAQ is Theme-native, dispatched canonically, and participates in derived navigation', async () => {
  const faq = await source('../../../packages/site-components/src/Faq.tsx')
  const renderer = await source('../components/SectionRenderer.tsx')
  const shell = await source('../../../packages/site-components/src/SiteShell.tsx')
  assert.match(faq, /site-radius-panel/)
  assert.match(faq, /text-site-(?:fg|muted)/)
  assert.match(faq, /border-site-border/)
  assert.match(renderer, /case 'faq':[\s\S]*<Faq content=\{section\.content\}/)
  assert.match(shell, /faq: 'FAQ'/)
  assert.match(shell, /sections\.filter\(\(section\) => section\.type !== 'hero'\)\.map/)
  assert.match(shell, /label: labels\[section\.type\]/)
  assert.match(shell, /`\$\{prefix\}#\$\{section\.id\}`/)
})
