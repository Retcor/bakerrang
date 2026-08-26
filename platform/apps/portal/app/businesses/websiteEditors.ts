export const websiteEditorGroups = ['Site setup', 'Homepage', 'Advanced'] as const

export type WebsiteEditorGroup = typeof websiteEditorGroups[number]

export const websiteEditors = [
  { id: 'branding', label: 'Branding', group: 'Site setup', description: 'Manage the site name, logo, and brand colors.' },
  { id: 'theme', label: 'Theme', group: 'Site setup', description: 'Set the visual style, typography, spacing, and colors.' },
  { id: 'businessProfile', label: 'Business Profile', group: 'Site setup', description: 'Maintain the business details used across the website.' },
  { id: 'businessHours', label: 'Business Hours', group: 'Site setup', description: 'Set weekly hours and their homepage presentation.' },
  { id: 'socialProfiles', label: 'Social Profiles', group: 'Site setup', description: 'Connect the business social profiles.' },
  { id: 'hero', label: 'Hero', group: 'Homepage', description: 'Shape the first message visitors see on the homepage.' },
  { id: 'about', label: 'About', group: 'Homepage', description: 'Tell visitors about the business.' },
  { id: 'services', label: 'Services', group: 'Homepage', description: 'Present the services the business offers.' },
  { id: 'gallery', label: 'Gallery', group: 'Homepage', description: 'Choose and arrange homepage gallery images.' },
  { id: 'testimonials', label: 'Testimonials', group: 'Homepage', description: 'Show customer quotes on the homepage.' },
  { id: 'faq', label: 'FAQ', group: 'Homepage', description: 'Answer common questions on the homepage.' },
  { id: 'contact', label: 'Contact', group: 'Homepage', description: 'Configure the homepage contact call to action.' },
  { id: 'sections', label: 'Manage Sections', group: 'Homepage', description: 'Choose and order the sections shown on the homepage.' },
  { id: 'customCss', label: 'Custom CSS', group: 'Advanced', description: 'Add scoped styling overrides for the website.' }
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  group: WebsiteEditorGroup
  description: string
}>

export type WebsiteEditorId = typeof websiteEditors[number]['id']
export type WebsitePaneId = WebsiteEditorId | 'overview'

export const overviewEditor = {
  id: 'overview',
  label: 'Overview',
  description: 'Review publication status and homepage structure.'
} as const

export const websiteEditorById = new Map<WebsiteEditorId, typeof websiteEditors[number]>(
  websiteEditors.map((editor) => [editor.id, editor])
)

export function parseWebsiteEditor (value: string | null): WebsiteEditorId | null {
  return value && websiteEditorById.has(value as WebsiteEditorId) ? value as WebsiteEditorId : null
}

export function websitePaneMetadata (id: WebsitePaneId) {
  return id === 'overview' ? overviewEditor : websiteEditorById.get(id) ?? overviewEditor
}
