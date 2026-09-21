'use client'

import { websiteEditors, type WebsiteEditorId } from './websiteEditors'

const moreSettings = websiteEditors.filter((editor) => editor.launcherGroup === 'moreSettings')

export function MoreSettingsPanel ({ onBack, onSelect }: {
  onBack: () => void
  onSelect: (editor: WebsiteEditorId) => void
}) {
  return <section className="flex min-h-0 flex-1 flex-col" aria-label="More settings">
    <header className="shrink-0 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
      <button aria-label="Site tools" className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm font-semibold text-fg-muted hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onBack} type="button"><svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>Site tools</button>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-fg">More settings</h2>
      <p className="mt-1 text-sm leading-5 text-fg-muted">Business details and advanced site settings.</p>
    </header>
    <div className="website-tool-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
    <div className="divide-y divide-border rounded-md border border-border">
      {moreSettings.map((editor) => <button className="flex min-h-11 items-center gap-3 rounded-md px-2.5 text-left text-sm font-semibold text-fg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus" key={editor.id} onClick={() => onSelect(editor.id as WebsiteEditorId)} type="button"><span>{editor.label}</span><span aria-hidden className="ml-auto text-fg-subtle">›</span></button>)}
    </div></div>
  </section>
}
