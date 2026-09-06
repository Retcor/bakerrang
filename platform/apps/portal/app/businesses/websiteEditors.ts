export const websiteEditorGroups = ['Site setup', 'Homepage', 'Advanced'] as const

export type WebsiteEditorGroup = typeof websiteEditorGroups[number]

export const websiteEditors = [
  { id: 'branding', label: 'Branding', group: 'Site setup', description: 'Manage the site name, logo, and favicon.' },
  { id: 'theme', label: 'Theme', group: 'Site setup', description: 'Set the visual style, typography, spacing, and colors.' },
  { id: 'businessProfile', label: 'Business Profile', group: 'Site setup', description: 'Maintain the business details used across the website.' },
  { id: 'businessHours', label: 'Business Hours', group: 'Site setup', description: 'Set the weekly schedule used across the website.' },
  { id: 'socialProfiles', label: 'Social Profiles', group: 'Site setup', description: 'Connect the business social profiles.' },
  { id: 'homepage', label: 'Homepage', group: 'Homepage', description: 'Choose, order, edit, and show or hide homepage sections.' },
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
