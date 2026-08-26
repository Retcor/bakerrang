import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

test('the public shell exposes the documented stable root and landmark hooks', async () => {
  const [shell, header, footer, home, contact] = await Promise.all([
    source('../../../packages/site-components/src/SiteShell.tsx'),
    source('../../../packages/site-components/src/SiteHeader.tsx'),
    source('../../../packages/site-components/src/SiteFooter.tsx'),
    source('../components/PublicHome.tsx'),
    source('../components/PublicContact.tsx')
  ])

  assert.match(shell, /data-br-\* attributes are stable public Custom CSS hooks\. Do not rename\/remove casually\./)
  assert.match(shell, /data-br-site=""/)
  assert.match(header, /data-br-role="header"/)
  assert.match(header, /data-br-role="nav"/)
  assert.match(footer, /data-br-role="footer"/)
  assert.match(footer, /data-br-role="nav"/)
  assert.match(footer, /data-br-role="social"/)
  assert.match(home, /<main data-br-role="main">/)
  assert.match(contact, /<main[^>]+data-br-role="main"/)
})

test('every Home section exposes a section type and canonical section id hook', async () => {
  const [primitives, hero, ...sections] = await Promise.all([
    source('../../../packages/site-components/src/SitePrimitives.tsx'),
    source('../../../packages/site-components/src/Hero.tsx'),
    ...['About', 'Services', 'Gallery', 'Testimonials', 'Faq', 'BusinessHours', 'Contact']
      .map((name) => source(`../../../packages/site-components/src/${name}.tsx`))
  ])

  assert.match(primitives, /data-br-section=\{id\} data-br-section-id=\{id\}/)
  assert.match(hero, /data-br-section="hero" data-br-section-id="hero"/)
  for (const [index, id] of ['about', 'services', 'gallery', 'testimonials', 'faq', 'businessHours', 'contact'].entries()) {
    assert.match(sections[index], new RegExp(`<SiteSection[^>]+id="${id}"`))
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
    source('../components/LeadForm.tsx')
  ])

  assert.match(primitives, /data-br-role="section-heading"/)
  assert.match(hero, /data-br-role="button"/)
  for (const cardSource of [services, gallery, testimonials, faq]) assert.match(cardSource, /data-br-role="card"/)
  assert.match(contact, /data-br-role="button"/)
  assert.match(leadForm, /data-br-role="form"/)
  assert.equal((leadForm.match(/data-br-role="input"/g) ?? []).length, 4)
  assert.match(leadForm, /data-br-role="button"/)
})
