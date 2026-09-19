'use client'

import { websiteEditors, type WebsiteLauncherId } from './websiteEditors'
import { SiteToolMenuRow } from './SiteToolMenu'

const tools = websiteEditors.filter((editor) => editor.launcherGroup === 'siteTools')
const fullScreenTools = websiteEditors.filter((editor) => editor.launcherGroup === 'fullScreenTools')

function BackIcon () { return <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg> }

export function SiteToolsPanel ({ onBack, onMoreSettings, onSelect }: { onBack: () => void, onMoreSettings: () => void, onSelect: (editor: WebsiteLauncherId) => void }) {
  const row = (editor: typeof websiteEditors[number]) => <SiteToolMenuRow icon={editor.id as WebsiteLauncherId} key={editor.id} label={editor.launcherLabel ?? editor.label} onClick={() => onSelect(editor.id as WebsiteLauncherId)} subtitle={editor.launcherSubtitle} />
  return <section aria-label="Site tools" className="flex min-h-0 flex-1 flex-col">
    <header className="shrink-0 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
      <button className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-semibold text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onBack} type="button"><BackIcon />Sections</button>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-fg">Site tools</h2>
      <p className="mt-1 text-sm leading-5 text-fg-muted">Manage your site’s shared design and settings.</p>
    </header>
    <div className="website-tool-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <section><p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle">DESIGN &amp; CONTENT</p><div className="mt-1 space-y-0.5">{tools.map(row)}</div></section>
      <section className="mt-6"><p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle">FULL-SCREEN TOOLS</p><div className="mt-1 space-y-0.5">{fullScreenTools.map(row)}</div></section>
      <section className="mt-6"><SiteToolMenuRow icon="moreSettings" label="More settings" onClick={onMoreSettings} tileClassName="bg-surface-muted text-fg-muted" /></section>
    </div>
  </section>
}
