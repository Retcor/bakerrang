import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { aboutParagraphs } from '../../../packages/site-components/src/aboutText.ts'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

test('About plain text splits only blank-line boundaries into semantic paragraph values', () => {
  assert.deepEqual(aboutParagraphs('First line.\ncontinued.\n\nSecond paragraph.\r\n \r\nThird.'), [
    'First line.\ncontinued.',
    'Second paragraph.',
    'Third.'
  ])
  assert.deepEqual(aboutParagraphs('  One paragraph  '), ['One paragraph'])
  assert.deepEqual(aboutParagraphs('   '), [])
})

test('About renders escaped React text, optional Theme-native image layout, and semantic paragraphs', async () => {
  const about = await source('../../../packages/site-components/src/About.tsx')
  assert.match(about, /<SiteSection anchorId=\{anchorId\} className="bg-site-bg" sectionType="about">/)
  assert.match(about, /<SiteContainer>/)
  assert.match(about, /lg:grid-cols-2/)
  assert.match(about, /site-radius-panel/)
  assert.match(about, /alt=\{content\.imageAlt\}/)
  assert.match(about, /paragraphs\.map\(\(paragraph, index\) => <p key=\{index\}>\{paragraph\}<\/p>\)/)
  assert.doesNotMatch(about, /dangerouslySetInnerHTML|Markdown|whitespace-pre-line/)
})

test('SectionRenderer and shell navigation use the canonical About section and anchor', async () => {
  const renderer = await source('../components/SectionRenderer.tsx')
  const shell = await source('../../../packages/site-components/src/SiteShell.tsx')
  assert.match(renderer, /case 'about':[\s\S]*<About anchorId=\{section\.id\} content=\{section\.content\}/)
  assert.match(shell, /about: 'About'/)
  assert.match(shell, /`\$\{prefix\}#section-\$\{section\.id\}`/)
})
