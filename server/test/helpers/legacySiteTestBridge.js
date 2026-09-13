// Transitional adapter for pre-3.0 tests. Production routes and services are exclusively id-targeted.
import * as sites from '../../services/siteService.js'

const home = (site) => site.pages[0]
const section = (site, type) => home(site).sections.find((item) => item.type === type)

const upsert = async (tenantId, type, input) => {
  let site = await sites.getSite(tenantId)
  let target = section(site, type)
  if (!target) {
    site = (await sites.addSection(tenantId, 'home', type)).site
    target = section(site, type)
  }
  return sites.updateSectionContent(tenantId, 'home', target.id, input)
}

export const updateHomeHero = async (tenantId, input) => {
  const site = await sites.getSite(tenantId)
  return sites.updateSectionContent(tenantId, 'home', section(site, 'hero').id, input)
}
export const upsertHomeAbout = (tenantId, input) => upsert(tenantId, 'about', input)
export const upsertHomeServices = (tenantId, input) => upsert(tenantId, 'services', input)
export const upsertHomeGallery = (tenantId, input) => upsert(tenantId, 'gallery', input)
export const upsertHomeTestimonials = (tenantId, input) => upsert(tenantId, 'testimonials', input)
export const upsertHomeFaq = (tenantId, input) => upsert(tenantId, 'faq', input)
export const upsertHomeContact = (tenantId, input) => upsert(tenantId, 'contact', input)

export const composeHomeSections = async (tenantId, input) => {
  if (!input || !Array.isArray(input.sectionIds)) throw Object.assign(new Error('Composition sectionIds must be an array'), { status: 400 })
  let site = await sites.getSite(tenantId)
  const desiredTypes = input.sectionIds
  for (const current of [...home(site).sections]) {
    if (!desiredTypes.includes(current.type)) site = await sites.removeSection(tenantId, 'home', current.id)
  }
  for (let desired = 1; desired < desiredTypes.length; desired += 1) {
    const target = section(site, desiredTypes[desired])
    if (!target) throw Object.assign(new Error('Unknown section id'), { status: 400 })
    let current = home(site).sections.findIndex((item) => item.id === target.id)
    while (current > desired) {
      site = await sites.moveSection(tenantId, 'home', target.id, 'up')
      current -= 1
    }
  }
  return site
}
