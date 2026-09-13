// Curated, source-controlled starting points. These are intentionally not tenant data:
// logical page keys are materialized into fresh Firestore ids by siteService.
const sharedSections = {
  about: {
    type: 'about',
    hidden: false,
    content: {
      heading: 'Built around your customers',
      body: 'Introduce your business, the people behind it, and the work you are proud to do.'
    }
  },
  services: {
    type: 'services',
    hidden: false,
    content: {
      title: 'What we offer',
      items: [
        { name: 'Service one', description: 'Describe a core service and the value it provides.' },
        { name: 'Service two', description: 'Explain another way you help customers.' },
        { name: 'Service three', description: 'Add the details that make your work distinct.' }
      ]
    }
  },
  process: {
    type: 'process',
    hidden: false,
    content: {
      heading: 'How it works',
      items: [
        { title: 'Start a conversation', description: 'Tell us what you need.' },
        { title: 'Make a plan', description: 'We will outline the next steps together.' },
        { title: 'Move forward', description: 'Get the service and support you came for.' }
      ]
    }
  },
  faq: {
    type: 'faq',
    hidden: false,
    content: {
      heading: 'Questions, answered',
      items: [
        { question: 'What should I expect?', answer: 'Use this answer to explain your process and what happens next.' },
        { question: 'How do I get started?', answer: 'Invite visitors to contact you with a short, clear next step.' }
      ]
    }
  },
  contact: {
    type: 'contact',
    hidden: false,
    content: {
      title: 'Let’s talk',
      text: 'Tell us a little about what you need and we will be in touch.',
      buttonLabel: 'Get in touch',
      action: { type: 'leadForm' }
    }
  }
}

const page = (key, slug, title, sections) => ({ key, slug, title, sections })

export const SITE_TEMPLATES = Object.freeze([
  {
    id: 'modern-local-service',
    version: 1,
    name: 'Modern Local Service',
    description: 'A clean, welcoming foundation for a nearby service business.',
    tags: ['local service', 'modern', 'friendly'],
    theme: {
      colors: { primary: '#1e3a5f', accent: '#d97706', background: '#f8fafc', text: '#172033' },
      headingFont: 'poppins',
      bodyFont: 'inter',
      cornerStyle: 'soft',
      contentWidth: 'standard',
      sectionSpacing: 'comfortable'
    },
    header: {
      brandDisplay: 'logoAndName',
      navigation: { items: [{ pageKey: 'home', label: 'Home' }, { pageKey: 'services', label: 'Services' }, { pageKey: 'about', label: 'About' }] }
    },
    footer: {
      showBranding: true,
      navigationMode: 'custom',
      navigationItems: [{ pageKey: 'home' }, { pageKey: 'contact', label: 'Contact' }],
      showBusinessContact: true,
      showSocialLinks: true,
      showCopyright: true
    },
    pages: [
      page('home', '/', 'Home', [
        { type: 'hero', hidden: false, content: { title: 'A better way to serve your neighborhood', subtitle: 'Make a confident first impression, then tailor every word to your business.' } },
        sharedSections.services, sharedSections.process, sharedSections.contact
      ]),
      page('services', 'services', 'Services', [sharedSections.services, sharedSections.faq, sharedSections.contact]),
      page('about', 'about', 'About', [sharedSections.about, sharedSections.contact]),
      page('contact', 'contact', 'Contact', [sharedSections.contact])
    ]
  },
  {
    id: 'classic-professional',
    version: 1,
    name: 'Classic Professional',
    description: 'A measured, trustworthy structure for professional services.',
    tags: ['professional', 'classic', 'trusted'],
    theme: {
      colors: { primary: '#233044', accent: '#8b5e34', background: '#fffdf8', text: '#1f2937' },
      headingFont: 'merriweather',
      bodyFont: 'workSans',
      cornerStyle: 'rounded',
      contentWidth: 'narrow',
      sectionSpacing: 'spacious'
    },
    header: {
      brandDisplay: 'name',
      navigation: { items: [{ pageKey: 'home', label: 'Home' }, { pageKey: 'approach', label: 'Our approach' }, { pageKey: 'contact', label: 'Contact' }] }
    },
    footer: {
      showBranding: true,
      navigationMode: 'custom',
      navigationItems: [{ pageKey: 'home' }, { pageKey: 'approach', label: 'Approach' }, { pageKey: 'contact' }],
      showBusinessContact: true,
      showSocialLinks: true,
      showCopyright: true
    },
    pages: [
      page('home', '/', 'Home', [
        { type: 'hero', hidden: false, content: { title: 'Practical guidance for your next step', subtitle: 'A clear, professional home for the expertise your clients count on.' } },
        sharedSections.about, sharedSections.services, sharedSections.contact
      ]),
      page('approach', 'approach', 'Our Approach', [sharedSections.process, sharedSections.faq, sharedSections.contact]),
      page('contact', 'contact', 'Contact', [sharedSections.contact])
    ]
  },
  {
    id: 'bold-contractor',
    version: 1,
    name: 'Bold Contractor',
    description: 'A direct, capable layout for hands-on home and trade services.',
    tags: ['contractor', 'trade', 'bold'],
    theme: {
      colors: { primary: '#1f2937', accent: '#ea580c', background: '#f7f7f5', text: '#111827' },
      headingFont: 'montserrat',
      bodyFont: 'inter',
      cornerStyle: 'square',
      contentWidth: 'wide',
      sectionSpacing: 'spacious'
    },
    header: {
      brandDisplay: 'logoAndName',
      navigation: { items: [{ pageKey: 'home', label: 'Home' }, { pageKey: 'services', label: 'Services' }, { pageKey: 'process', label: 'Process' }, { pageKey: 'contact', label: 'Contact' }] }
    },
    footer: {
      showBranding: true,
      navigationMode: 'custom',
      navigationItems: [{ pageKey: 'services' }, { pageKey: 'process' }, { pageKey: 'contact' }],
      showBusinessContact: true,
      showSocialLinks: true,
      showCopyright: true
    },
    pages: [
      page('home', '/', 'Home', [
        { type: 'hero', hidden: false, content: { title: 'Work that starts with a solid plan', subtitle: 'Show homeowners and property managers how to take the next step with you.' } },
        sharedSections.services, sharedSections.process, sharedSections.contact
      ]),
      page('services', 'services', 'Services', [sharedSections.services, sharedSections.contact]),
      page('process', 'process', 'Our Process', [sharedSections.process, sharedSections.faq, sharedSections.contact]),
      page('contact', 'contact', 'Contact', [sharedSections.contact])
    ]
  }
])

export const siteTemplateMetadata = (template) => ({
  id: template.id,
  version: template.version,
  name: template.name,
  description: template.description,
  tags: [...template.tags]
})

export const getSiteTemplate = (templateId) => SITE_TEMPLATES.find((template) => template.id === templateId)
