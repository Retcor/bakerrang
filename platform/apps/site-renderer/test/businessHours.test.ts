import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { formatBusinessTime, WEEKDAYS } from '../../../packages/site-components/src/businessHoursFormat.ts'
import { localBusinessData } from '../lib/seo.ts'

const source = async (relative: string) => readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const hours = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '08:30', close: '16:30' },
  wednesday: { closed: true },
  thursday: { open: '12:00', close: '20:00' },
  friday: { open: '13:30', close: '23:45' },
  saturday: { closed: true },
  sunday: { closed: true }
} as const

const site = (businessHours: unknown, withSection = true, operational = true) => ({
  status: 'PUBLISHED',
  branding: { siteName: 'Bakery' },
  businessProfile: { ...(operational ? { phone: '+1 303 555 0100' } : {}), ...(businessHours ? { businessHours } : {}) },
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero', type: 'hero', content: { title: 'Welcome' } },
    ...(withSection ? [{ id: 'businessHours', type: 'businessHours', content: {} }] : [])
  ] }]
}) as never

test('Business Hours formatter is timezone-free and weekday order is deterministic', () => {
  assert.deepEqual(WEEKDAYS.map((day) => day.key), [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ])
  assert.deepEqual(['00:00', '09:00', '12:00', '13:30', '23:45'].map(formatBusinessTime), [
    '12:00 AM', '9:00 AM', '12:00 PM', '1:30 PM', '11:45 PM'
  ])
})

test('Business Hours component uses themed semantic markup, defaults its heading, and safely skips missing hours', async () => {
  const component = await source('../../../packages/site-components/src/BusinessHours.tsx')
  assert.match(component, /<SiteSection anchorId=\{anchorId\} className="bg-site-bg" sectionType="businessHours">/)
  assert.match(component, /<SiteContainer>/)
  assert.match(component, /<SectionHeading>\{heading\}<\/SectionHeading>/)
  assert.match(component, /<dl className=/)
  assert.match(component, /<dt className=/)
  assert.match(component, /<dd className=/)
  assert.match(component, /: 'Business Hours'/)
  assert.match(component, /if \(!hours\) return null/)
  assert.match(component, /\{intro && <p/)
  assert.doesNotMatch(component, /Date\(|Open now|Today/)
})

test('renderer dispatches canonical hours and navigation derives Hours only from the section list', async () => {
  const renderer = await source('../components/SectionRenderer.tsx')
  const home = await source('../components/PublicHome.tsx')
  const shell = await source('../../../packages/site-components/src/SiteShell.tsx')
  assert.match(renderer, /case 'businessHours':[\s\S]*<BusinessHours anchorId=\{section\.id\} content=\{section\.content\} hours=\{businessHours\}/)
  assert.match(home, /businessHours=\{site\.businessProfile\?\.businessHours\}/)
  assert.match(shell, /businessHours: 'Hours'/)
  assert.match(shell, /sections\.filter\(\(section\) => !section\.hidden && section\.type !== 'hero'\)\.map/)
})

test('LocalBusiness opening specifications include only open canonical days without changing the emission gate', () => {
  const data = localBusinessData(site(hours), null)
  assert.deepEqual(data?.openingHoursSpecification, [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '09:00', closes: '17:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Tuesday', opens: '08:30', closes: '16:30' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Thursday', opens: '12:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Friday', opens: '13:30', closes: '23:45' }
  ])
  assert.equal(localBusinessData(site(hours, false, false), null), null)
  assert.equal(localBusinessData(site(undefined), null)?.openingHoursSpecification, undefined)
  assert.equal(localBusinessData(site({
    monday: { closed: true }, tuesday: { closed: true }, wednesday: { closed: true },
    thursday: { closed: true }, friday: { closed: true }, saturday: { closed: true }, sunday: { closed: true }
  }), null)?.openingHoursSpecification, undefined)
})
