import { randomUUID } from 'node:crypto'

export const SECTION_TYPES = Object.freeze([
  'hero', 'about', 'services', 'gallery', 'testimonials', 'faq', 'businessHours', 'contact',
  'process', 'stats', 'cta', 'logos'
])

export const SINGLETON_SECTION_TYPES = new Set(['hero', 'contact', 'businessHours'])

export const defaultSectionContent = (type, { siteName = 'Website' } = {}) => {
  switch (type) {
    case 'hero': return { title: siteName }
    case 'about': return { heading: 'About us', body: 'Tell visitors about your business.' }
    case 'services': return { title: 'Services', items: [{ id: randomUUID(), name: 'Service' }] }
    // A gallery starts empty so adding it never fabricates a media reference.
    case 'gallery': return { title: 'Gallery', items: [] }
    case 'testimonials': return { title: 'Testimonials', items: [{ id: randomUUID(), customerName: 'Customer', quote: 'Add a customer testimonial.' }] }
    case 'faq': return { heading: 'Frequently asked questions', items: [{ id: randomUUID(), question: 'Question', answer: 'Answer' }] }
    case 'businessHours': return {}
    case 'contact': return { title: 'Contact us', buttonLabel: 'Get in touch', action: { type: 'leadForm' } }
    case 'process': return { heading: 'How it works', items: [{ id: randomUUID(), title: 'Add your first step' }] }
    case 'stats': return { heading: 'Highlights', items: [{ id: randomUUID(), value: '—', label: 'Add a highlight' }] }
    case 'cta': return { heading: 'Ready to get started?' }
    case 'logos': return { heading: 'Trusted by', items: [] }
    default: return null
  }
}

export const createDefaultSection = (type, options) => {
  const content = defaultSectionContent(type, options)
  return content ? { id: randomUUID(), type, hidden: false, content } : null
}
