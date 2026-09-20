import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { contactHref } from '../../../packages/site-components/src/contactHref.ts'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

test('the public shell exposes the documented stable root and landmark hooks', async () => {
  const [shell, header, footer, page] = await Promise.all([
    source('../../../packages/site-components/src/SiteShell.tsx'),
    source('../../../packages/site-components/src/SiteHeader.tsx'),
    source('../../../packages/site-components/src/SiteFooter.tsx'),
    source('../../../packages/site-runtime/src/SitePageRenderer.tsx')
  ])

  assert.match(shell, /data-br-\* attributes are stable public Custom CSS hooks\. Do not rename\/remove casually\./)
  assert.match(shell, /data-br-page=\{activePage\.id\} data-br-site=""/)
  assert.match(header, /data-br-role="header"/)
  assert.match(header, /data-br-role="nav"/)
  assert.match(header, /data-br-navigation=""/)
  assert.match(header, /data-br-navigation-item=\{item\.pageId\}/)
  assert.match(footer, /data-br-role="footer"/)
  assert.match(footer, /data-br-footer-navigation=""/)
  assert.match(footer, /data-br-role="social"/)
  assert.match(page, /<main data-br-role="main">/)
})

test('every Home section exposes stable type and opaque instance hooks', async () => {
  const [primitives, hero, ...sections] = await Promise.all([
    source('../../../packages/site-components/src/SitePrimitives.tsx'),
    source('../../../packages/site-components/src/Hero.tsx'),
    ...['About', 'Services', 'Gallery', 'Testimonials', 'Faq', 'BusinessHours', 'Contact']
      .map((name) => source(`../../../packages/site-components/src/${name}.tsx`))
  ])

  assert.match(primitives, /data-br-section=\{sectionType\} data-br-section-id=\{anchorId\} id=\{`section-\$\{anchorId\}`\}/)
  assert.match(hero, /data-br-section="hero" data-br-section-id=\{anchorId\} id=\{`section-\$\{anchorId\}`\}/)
  for (const [index, id] of ['about', 'services', 'gallery', 'testimonials', 'faq', 'businessHours', 'contact'].entries()) {
    assert.match(sections[index], new RegExp(`<SiteSection anchorId=\\{anchorId\\}[^>]+sectionType="${id}"`))
  }
})

test('public headings, cards, CTAs, and lead fields expose semantic hooks', async () => {
  const [primitives, hero, services, gallery, testimonials, faq, contact, leadForm] = await Promise.all([
    source('../../../packages/site-components/src/SitePrimitives.tsx'),
    source('../../../packages/site-components/src/Hero.tsx'),
    source('../../../packages/site-components/src/Services.tsx'),
    source('../../../packages/site-components/src/Gallery.tsx'),
    source('../../../packages/site-components/src/Testimonials.tsx'),
    source('../../../packages/site-components/src/Faq.tsx'),
    source('../../../packages/site-components/src/Contact.tsx'),
    source('../../../packages/site-runtime/src/LeadForm.tsx')
  ])

  assert.match(primitives, /data-br-role="section-heading"/)
  assert.match(hero, /data-br-role="button"/)
  for (const cardSource of [services, gallery, testimonials, faq]) assert.match(cardSource, /data-br-role="card"/)
  assert.match(contact, /data-br-role="button"/)
  assert.match(leadForm, /data-br-role="form"/)
  assert.equal((leadForm.match(/data-br-role="input"/g) ?? []).length, 4)
  assert.match(leadForm, /data-br-role="button"/)
})

test('public lead controls use only the base tenant token contract', async () => {
  const [themeCss, leadForm] = await Promise.all([
    source('../../../packages/site-components/src/site-theme.css'),
    source('../../../packages/site-runtime/src/LeadForm.tsx')
  ])

  assert.match(themeCss, /--color-surface: var\(--site-surface\);/)
  assert.match(themeCss, /--color-border: var\(--site-border\);/)
  assert.match(themeCss, /--color-fg: var\(--site-fg\);/)
  assert.match(themeCss, /--color-fg-muted: var\(--site-muted\);/)
  assert.match(themeCss, /--color-accent: var\(--site-primary\);/)
  assert.match(themeCss, /--color-accent-fg: var\(--site-primary-fg\);/)

  const classNameFor = (tag: 'input' | 'textarea', id: string) => {
    const className = leadForm.match(new RegExp(`<${tag}[^>]*className="([^"]+)"[^>]*id="${id}"`))?.[1]
    assert.ok(className, `${id} should expose a className`)
    return className
  }
  const fieldClassNames = [
    classNameFor('input', 'lead-name'),
    classNameFor('input', 'lead-email'),
    classNameFor('input', 'lead-phone'),
    classNameFor('textarea', 'lead-message')
  ]

  for (const className of fieldClassNames) {
    assert.match(className, /(?:^|\s)border-border(?:\s|$)/)
    assert.doesNotMatch(className, /border-border-strong/)
    assert.match(className, /(?:^|\s)bg-surface(?:\s|$)/)
    assert.match(className, /(?:^|\s)text-fg(?:\s|$)/)
    assert.match(className, /placeholder:text-fg-muted/)
    assert.match(className, /focus:border-accent/)
  }

  const buttonClassName = leadForm.match(/<button className="([^"]+)"[^>]*type="submit"/)?.[1]
  assert.ok(buttonClassName, 'Send Message should use a raw public button')
  assert.match(buttonClassName, /(?:^|\s)bg-accent(?:\s|$)/)
  assert.match(buttonClassName, /(?:^|\s)text-accent-fg(?:\s|$)/)
  assert.match(buttonClassName, /focus-visible:outline-accent/)
  assert.doesNotMatch(buttonClassName, /border-border-strong|outline-focus|bg-brand-(?:hover|active)|surface-muted|text-fg-subtle/)

  assert.doesNotMatch(leadForm, /border-border-strong|focus:border-focus|text-fg-subtle/)
  assert.doesNotMatch(leadForm, /from ['"]@bakerrang\/ui['"]/)
})

test('public lead honeypot remains present, hidden off-screen, and out of the tab order', async () => {
  const [globals, leadForm] = await Promise.all([
    source('../app/globals.css'),
    source('../../../packages/site-runtime/src/LeadForm.tsx')
  ])

  assert.match(globals, /@source "\.\.\/\.\.\/\.\.\/packages\/site-runtime\/src";/)
  assert.match(leadForm, /<div aria-hidden="true" className="absolute -left-\[10000px\] h-px w-px overflow-hidden">/)
  assert.match(leadForm, /<input autoComplete="off" id="lead-website".*tabIndex=\{-1\}/)
})

test('Contact retains safe email, phone, and URL actions while leadForm renders inline', async () => {
  assert.equal(contactHref({ type: 'email', value: 'hello@example.com' }), 'mailto:hello@example.com')
  assert.equal(contactHref({ type: 'phone', value: '+1 (303) 555-0123' }), 'tel:+13035550123')
  assert.equal(contactHref({ type: 'url', value: 'https://example.com/contact' }), 'https://example.com/contact')
  assert.equal(contactHref({ type: 'leadForm' }), null)
  const contact = await source('../../../packages/site-components/src/Contact.tsx')
  assert.match(contact, /content\?\.action\?\.type === 'leadForm' && leadForm/)
  assert.match(contact, /content\?\.action\?\.type === 'leadForm' \? null : contactHref/)
})
