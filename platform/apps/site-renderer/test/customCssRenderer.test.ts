import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

test('SiteShell emits one conditional style node from scopedCustomCss only', async () => {
  const shell = await source('../../../packages/site-components/src/SiteShell.tsx')
  assert.match(shell, /site\.scopedCustomCss \? <style id="br-custom-css">\{site\.scopedCustomCss\}<\/style> : null/)
  assert.doesNotMatch(shell, /<style[^>]*>\{site\.customCss\}/)
  assert.doesNotMatch(shell, /dangerouslySetInnerHTML|DOMParser|eval\(|new Function/)
  assert.equal((shell.match(/id="br-custom-css"/g) ?? []).length, 1)
})

test('the generic public page owns the single SiteShell injection path', async () => {
  const [home, page] = await Promise.all([
    source('../components/PublicHome.tsx'),
    source('../components/PublicPage.tsx')
  ])
  assert.match(home, /<PublicPage navigationContext=\{navigationContext\} page=\{home\}/)
  assert.match(page, /<SiteShell activePage=\{page\} footerNav=\{navigation\.footerItems\}/)
  assert.doesNotMatch(`${home}\n${page}`, /br-custom-css|site\.customCss/)
  assert.doesNotMatch(`${home}\n${page}`, /data-preview-(?:frame|banner|site-layer)/)
})

test('breakout-safe scoped CSS remains inert text in normal JSX rendering', () => {
  const safeScopedCss = '[data-br-site]::before{content:"\\3c /style>\\3c script>alert(1)\\3c /script>"}'
  const markup = renderToStaticMarkup(createElement('style', { id: 'br-custom-css' }, safeScopedCss))
  assert.match(markup, /^<style id="br-custom-css">/)
  assert.equal(markup.includes('</style><script>'), false)
  assert.equal(markup.includes('<script>'), false)
})

test('Preview owns a higher banner layer and isolated lower tenant layer outside the site scope', async () => {
  const frame = await source('../components/PreviewFrame.tsx')
  assert.match(frame, /<div data-preview-frame="">/)
  assert.match(frame, /className="sticky top-0 z-50[^>]+data-preview-banner=""/)
  assert.match(frame, /className="relative z-0 isolate" data-preview-site-layer="">[\s\S]*\{children\}/)
  assert.ok(frame.indexOf('data-preview-banner') < frame.indexOf('data-preview-site-layer'))
  assert.doesNotMatch(frame, /data-br-site|transform:|translateZ|contain:/)
})
