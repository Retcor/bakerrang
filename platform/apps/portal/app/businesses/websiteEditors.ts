export const websiteEditorGroups = ['Site setup', 'Design', 'Site structure', 'Search & sharing', 'Publishing', 'Advanced'] as const

export type WebsiteEditorGroup = typeof websiteEditorGroups[number]

type WebsiteEditorMetadata = {
  id: string
  label: string
  group: WebsiteEditorGroup
  description: string
  launcherGroup?: 'siteTools' | 'fullScreenTools' | 'moreSettings'
  launcherLabel?: string
  launcherSubtitle?: string
}

const websiteEditorRecords = [
  { id: 'branding', label: 'Branding', group: 'Site setup', description: 'Manage the site name, logo, and favicon.', launcherGroup: 'siteTools', launcherSubtitle: 'Logo, site name, favicon' },
  { id: 'theme', label: 'Theme', group: 'Site setup', description: 'Set the visual style, typography, spacing, and colors.', launcherGroup: 'siteTools', launcherSubtitle: 'Colours, fonts, shape' },
  { id: 'businessProfile', label: 'Business Profile', group: 'Site setup', description: 'Maintain the business details used across the website.', launcherGroup: 'moreSettings' },
  { id: 'businessHours', label: 'Business Hours', group: 'Site setup', description: 'Set the weekly schedule used across the website.', launcherGroup: 'moreSettings' },
  { id: 'socialProfiles', label: 'Social Profiles', group: 'Site setup', description: 'Connect the business social profiles.', launcherGroup: 'moreSettings' },
  { id: 'templates', label: 'Templates', group: 'Design', description: 'Restyle the working site while keeping its pages and content.', launcherGroup: 'fullScreenTools' },
  { id: 'pages', label: 'Pages', group: 'Site structure', description: 'Create, organize, and edit the site’s pages.' },
  { id: 'header', label: 'Header & Navigation', group: 'Site structure', description: 'Configure the shared header, navigation, and optional call to action.', launcherGroup: 'siteTools', launcherLabel: 'Header & navigation', launcherSubtitle: 'Menu links and call-to-action' },
  { id: 'footer', label: 'Footer', group: 'Site structure', description: 'Configure the shared footer and its global information.', launcherGroup: 'siteTools', launcherSubtitle: 'Contact, social, copyright' },
  { id: 'seo', label: 'SEO & Social', group: 'Search & sharing', description: 'Manage search descriptions, sharing images, and indexing preferences.', launcherGroup: 'siteTools', launcherLabel: 'SEO & social', launcherSubtitle: 'Titles, description, share image' },
  { id: 'revisions', label: 'Revision History', group: 'Publishing', description: 'View published snapshots or restore one to the working site.', launcherGroup: 'fullScreenTools' },
  { id: 'customCss', label: 'Custom CSS', group: 'Advanced', description: 'Add scoped styling overrides for the website.', launcherGroup: 'moreSettings' }
] as const satisfies ReadonlyArray<WebsiteEditorMetadata>

export const websiteEditors: readonly WebsiteEditorMetadata[] = websiteEditorRecords

export type WebsiteEditorId = typeof websiteEditorRecords[number]['id'] | 'page'
export type WebsitePaneId = WebsiteEditorId | 'overview'
export type WebsiteLauncherId = typeof websiteEditorRecords[number]['id'] | 'moreSettings'

export const overviewEditor = {
  id: 'overview',
  label: 'Overview',
  description: 'Review publication status and the working site structure.'
} as const

export const websiteEditorById = new Map<WebsiteEditorId, WebsiteEditorMetadata>(
  websiteEditorRecords.map((editor) => [editor.id, editor] as const)
)

export function parseWebsiteEditor (value: string | null): WebsiteEditorId | null {
  return value === 'page' || (value && websiteEditorById.has(value as WebsiteEditorId)) ? value as WebsiteEditorId : null
}

export function websitePaneMetadata (id: WebsitePaneId) {
  return id === 'overview' ? overviewEditor : websiteEditorById.get(id) ?? overviewEditor
}
