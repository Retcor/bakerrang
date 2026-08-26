'use client'

import { useState } from 'react'
import { Dialog } from '@bakerrang/ui'
import {
  overviewEditor,
  websiteEditorGroups,
  websiteEditors,
  websitePaneMetadata,
  type WebsitePaneId
} from './websiteEditors'

function NavigationItems ({ active, onSelect }: {
  active: WebsitePaneId
  onSelect: (editor: WebsitePaneId) => void
}) {
  const itemClass = (selected: boolean) => `flex min-h-11 w-full items-center rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'}`
  return (
    <>
      <button aria-current={active === 'overview' ? 'page' : undefined} className={itemClass(active === 'overview')} onClick={() => onSelect('overview')} type="button">
        {overviewEditor.label}
      </button>
      {websiteEditorGroups.map((group, index) => (
        <section aria-labelledby={`website-nav-${group.replace(' ', '-').toLowerCase()}`} className={index === 0 ? 'mt-6' : 'mt-6 border-t border-border pt-5'} key={group}>
          <h3 className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-fg-subtle" id={`website-nav-${group.replace(' ', '-').toLowerCase()}`}>{group}</h3>
          <div className="mt-2 space-y-1">
            {websiteEditors.filter((editor) => editor.group === group).map((editor) => (
              <button aria-current={active === editor.id ? 'page' : undefined} className={itemClass(active === editor.id)} key={editor.id} onClick={() => onSelect(editor.id)} type="button">
                {editor.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

export function WebsiteEditorNavigation ({ active, onSelect }: {
  active: WebsitePaneId
  onSelect: (editor: WebsitePaneId) => void
}) {
  const [open, setOpen] = useState(false)
  const current = websitePaneMetadata(active)
  const selectMobile = (editor: WebsitePaneId) => {
    setOpen(false)
    onSelect(editor)
  }
  return (
    <>
      <nav aria-label="Website editor navigation" className="hidden rounded-lg border border-border bg-surface-muted/60 p-3 lg:block">
        <NavigationItems active={active} onSelect={onSelect} />
      </nav>
      <div className="lg:hidden">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-fg-subtle">Currently editing</p>
        <button aria-haspopup="dialog" className="mt-2 flex min-h-11 w-full items-center justify-between gap-4 rounded-md border border-border-strong bg-surface px-4 py-2 text-left font-semibold text-fg shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => setOpen(true)} type="button">
          <span className="min-w-0 truncate">{current.label}</span>
          <span className="shrink-0 text-sm text-fg-muted">Change</span>
        </button>
      </div>
      <Dialog description="Choose an overview or editor. Editors are grouped by the part of the website they control." onClose={() => setOpen(false)} open={open} title="Website navigation">
        <nav aria-label="Website editor selector">
          <NavigationItems active={active} onSelect={selectMobile} />
        </nav>
      </Dialog>
    </>
  )
}
