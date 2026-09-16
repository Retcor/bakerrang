'use client'

import { StatusMessage } from '@bakerrang/ui'
import type { SectionType, SiteDefinition } from '@bakerrang/site-schema'
import type { ReactNode } from 'react'
import { addableSectionTypes, type SectionDefinition } from './sectionDefinitions'

const groups: SectionDefinition['group'][] = ['Core', 'Content', 'Media', 'Trust', 'Conversion', 'Business']

function SectionGlyph ({ type }: { type: SectionType }) {
  const paths: Record<SectionType, ReactNode> = {
    hero: <path d="M4 18 10 6l4 7 2-3 4 8H4Z" />,
    about: <><circle cx="12" cy="8" r="3" /><path d="M5 20c1.3-4 4-6 7-6s5.7 2 7 6" /></>,
    services: <><rect height="5" rx="1" width="5" x="4" y="4" /><rect height="5" rx="1" width="5" x="15" y="4" /><rect height="5" rx="1" width="5" x="4" y="15" /><rect height="5" rx="1" width="5" x="15" y="15" /></>,
    gallery: <><rect height="15" rx="1.5" width="18" x="3" y="4" /><path d="m5 16 4-4 3 3 3-4 4 5M8 8h.01" /></>,
    testimonials: <path d="M5 7h6v5H8l-2 4v-4H5V7Zm8 0h6v5h-3l-2 4v-4h-1V7Z" />,
    faq: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9a2.7 2.7 0 0 1 5 1.4c0 1.8-2.5 2-2.5 4M12 17h.01" /></>,
    businessHours: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    contact: <><path d="M5 5h14v14H5z" /><path d="m6 7 6 5 6-5" /></>,
    process: <><path d="M7 5h12M7 12h12M7 19h12" /><circle cx="4" cy="5" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="19" r="1" /></>,
    stats: <><path d="M5 19V10M12 19V5M19 19v-7" /><path d="M3 19h18" /></>,
    cta: <><path d="M5 12h13M14 7l5 5-5 5" /></>,
    logos: <><circle cx="8" cy="9" r="3" /><circle cx="16" cy="15" r="3" /><path d="m10 11 4 2" /></>
  }
  return <svg aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[type]}</svg>
}

export function AddSectionPanel ({ busy = false, error, onBack, onChoose, pageId, site }: {
  busy?: boolean
  error?: string | null
  onBack: () => void
  onChoose: (type: SectionType) => void
  pageId: string
  site: SiteDefinition
}) {
  const page = site.pages.find((candidate) => candidate.id === pageId)
  const choices = addableSectionTypes(site, pageId)
  return <section aria-label="Add a section" className="flex min-h-0 flex-1 flex-col">
    <div className="border-b border-border px-4 py-4">
      <button className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-focus" onClick={onBack} type="button">
        <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>Back
      </button>
      <h2 className="mt-3 text-base font-semibold tracking-tight text-fg">Add a section</h2>
      <p className="mt-1 text-sm leading-5 text-fg-muted">Choose a section to add to {page?.title ?? 'this page'}.</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <div className={error ? 'mt-4 space-y-5' : 'space-y-5'}>
        {groups.map((group) => {
          const groupChoices = choices.filter((choice) => choice.definition.group === group)
          if (!groupChoices.length) return null
          return <section key={group}><p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">{group}</p><div className="mt-2 space-y-1">
            {groupChoices.map(({ definition, disabled, reason, type }) => <button aria-describedby={reason ? `add-section-${type}-reason` : undefined} className={`flex w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${disabled ? 'cursor-not-allowed border-transparent bg-surface-muted/60 text-fg-subtle' : 'border-transparent text-fg-muted hover:border-border hover:bg-surface-muted hover:text-fg'}`} disabled={disabled || busy} key={type} onClick={() => onChoose(type)} type="button">
              <span className={`mt-0.5 grid size-7 place-items-center rounded-md ${disabled ? 'bg-surface text-fg-subtle' : 'bg-brand-subtle text-brand-ink'}`}><SectionGlyph type={type} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">{definition.label}</span><span className="mt-0.5 block text-xs leading-5 text-fg-muted">{definition.description}</span>{reason && <span className="mt-1 block text-xs font-medium text-fg-subtle" id={`add-section-${type}-reason`}>{reason}</span>}</span>
            </button>)}
          </div></section>
        })}
      </div>
    </div>
  </section>
}
