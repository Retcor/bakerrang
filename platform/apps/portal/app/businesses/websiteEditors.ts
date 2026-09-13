export const websiteEditorGroups = ['Site setup', 'Design', 'Site structure', 'Search & sharing', 'Publishing', 'Advanced'] as const

export type WebsiteEditorGroup = typeof websiteEditorGroups[number]

export const websiteEditors = [
  { id: 'branding', label: 'Branding', group: 'Site setup', description: 'Manage the site name, logo, and favicon.' },
  { id: 'theme', label: 'Theme', group: 'Site setup', description: 'Set the visual style, typography, spacing, and colors.' },
  { id: 'businessProfile', label: 'Business Profile', group: 'Site setup', description: 'Maintain the business details used across the website.' },
  { id: 'businessHours', label: 'Business Hours', group: 'Site setup', description: 'Set the weekly schedule used across the website.' },
  { id: 'socialProfiles', label: 'Social Profiles', group: 'Site setup', description: 'Connect the business social profiles.' },
  { id: 'templates', label: 'Templates', group: 'Design', description: 'Apply a curated starting point to the working site.' },
  { id: 'pages', label: 'Pages', group: 'Site structure', description: 'Create, organize, and edit the site’s pages.' },
  { id: 'header', label: 'Header & Navigation', group: 'Site structure', description: 'Configure the shared header, navigation, and optional call to action.' },
  { id: 'footer', label: 'Footer', group: 'Site structure', description: 'Configure the shared footer and its global information.' },
  { id: 'seo', label: 'SEO & Social', group: 'Search & sharing', description: 'Manage search descriptions, sharing images, and indexing preferences.' },
  { id: 'revisions', label: 'Revision History', group: 'Publishing', description: 'Restore a recent published revision to the working site.' },
  { id: 'customCss', label: 'Custom CSS', group: 'Advanced', description: 'Add scoped styling overrides for the website.' }
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  group: WebsiteEditorGroup
  description: string
}>

export type WebsiteEditorId = typeof websiteEditors[number]['id'] | 'page'
export type WebsitePaneId = WebsiteEditorId | 'overview'

export const overviewEditor = {
  id: 'overview',
  label: 'Overview',
  description: 'Review publication status and the working site structure.'
} as const

export const websiteEditorById = new Map<WebsiteEditorId, typeof websiteEditors[number]>(
  websiteEditors.map((editor) => [editor.id, editor])
)

export function parseWebsiteEditor (value: string | null): WebsiteEditorId | null {
  return value === 'page' || (value && websiteEditorById.has(value as WebsiteEditorId)) ? value as WebsiteEditorId : null
}

export function websitePaneMetadata (id: WebsitePaneId) {
  return id === 'overview' ? overviewEditor : websiteEditorById.get(id) ?? overviewEditor
}
