// Curated, source-controlled design presets. Templates deliberately own only
// presentation fields; tenant pages, content, navigation, SEO, and CSS are not
// template data.
export const SITE_TEMPLATES = Object.freeze([
  {
    id: 'modern-local-service',
    version: 1,
    name: 'Modern Local Service',
    description: 'Clean, welcoming styling for a nearby service business.',
    tags: ['local service', 'modern', 'friendly'],
    theme: {
      colors: { primary: '#1e3a5f', accent: '#d97706', background: '#f8fafc', text: '#172033' },
      headingFont: 'poppins',
      bodyFont: 'inter',
      cornerStyle: 'soft',
      contentWidth: 'standard',
      sectionSpacing: 'comfortable'
    },
    header: { brandDisplay: 'logoAndName' },
    footer: {
      showBranding: true,
      showBusinessContact: true,
      showSocialLinks: true,
      showCopyright: true
    }
  },
  {
    id: 'classic-professional',
    version: 1,
    name: 'Classic Professional',
    description: 'Measured, trustworthy styling for professional services.',
    tags: ['professional', 'classic', 'trusted'],
    theme: {
      colors: { primary: '#233044', accent: '#8b5e34', background: '#fffdf8', text: '#1f2937' },
      headingFont: 'merriweather',
      bodyFont: 'workSans',
      cornerStyle: 'rounded',
      contentWidth: 'narrow',
      sectionSpacing: 'spacious'
    },
    header: { brandDisplay: 'name' },
    footer: {
      showBranding: true,
      showBusinessContact: true,
      showSocialLinks: true,
      showCopyright: true
    }
  },
  {
    id: 'bold-contractor',
    version: 1,
    name: 'Bold Contractor',
    description: 'Direct, capable styling for hands-on home and trade services.',
    tags: ['contractor', 'trade', 'bold'],
    theme: {
      colors: { primary: '#1f2937', accent: '#ea580c', background: '#f7f7f5', text: '#111827' },
      headingFont: 'montserrat',
      bodyFont: 'inter',
      cornerStyle: 'square',
      contentWidth: 'wide',
      sectionSpacing: 'spacious'
    },
    header: { brandDisplay: 'logoAndName' },
    footer: {
      showBranding: true,
      showBusinessContact: true,
      showSocialLinks: true,
      showCopyright: true
    }
  }
])

export const siteTemplatePreview = (template) => ({
  theme: structuredClone(template.theme),
  header: { brandDisplay: template.header.brandDisplay },
  footer: {
    showBranding: template.footer.showBranding,
    showBusinessContact: template.footer.showBusinessContact,
    showSocialLinks: template.footer.showSocialLinks,
    showCopyright: template.footer.showCopyright
  }
})

export const siteTemplateMetadata = (template) => ({
  id: template.id,
  version: template.version,
  name: template.name,
  description: template.description,
  tags: [...template.tags],
  preview: siteTemplatePreview(template)
})

export const getSiteTemplate = (templateId) => SITE_TEMPLATES.find((template) => template.id === templateId)
