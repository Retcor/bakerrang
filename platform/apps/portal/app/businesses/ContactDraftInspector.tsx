'use client'

import type { ContactContent, ContactSection } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'
import { SectionActionFieldsDraft } from './SectionActionFieldsDraft'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function ContactIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><rect height="14" rx="2" width="16" x="4" y="5" /><path d="m5 8 7 5 7-5" /></svg>
}

function WarningIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
}

export function contactContentError (content: ContactContent): string | null {
  if (!content.title.trim()) return 'Section heading is required.'
  if (content.title.trim().length > 150) return 'Section heading must be 150 characters or fewer.'
  if ((content.text?.trim().length ?? 0) > 500) return 'Supporting text must be 500 characters or fewer.'
  if (!content.buttonLabel.trim()) return 'Button label is required.'
  if (content.action.type === 'email' && !content.action.value.trim()) return 'Add an email address.'
  if (content.action.type === 'phone' && !content.action.value.trim()) return 'Add a phone number.'
  if (content.action.type === 'url' && !content.action.value.trim()) return 'Add a website URL.'
  return null
}

export function ContactDraftInspector ({ section, onChange, saving }: {
  section: ContactSection
  onChange: (content: ContactContent) => void
  saving: boolean
}) {
  const { content } = section
  const validationError = contactContentError(content)
  return (
    <section aria-label="Contact properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><ContactIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Contact</h2><p className="mt-0.5 text-xs text-fg-subtle">One clear way for visitors to get in touch.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`contact-title-${section.id}`}>Section heading</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.title.length} / 150</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`contact-title-${section.id}`} maxLength={150} onChange={(event) => onChange({ ...content, title: event.target.value })} value={content.title} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`contact-text-${section.id}`}>Supporting text <span aria-hidden className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.text ?? '').length} / 500</span>
        </div>
        <Textarea aria-label="Supporting text" className="mt-1.5 min-h-16 resize-y" disabled={saving} id={`contact-text-${section.id}`} maxLength={500} onChange={(event) => onChange({ ...content, text: event.target.value })} value={content.text ?? ''} />
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Button</h3>
        <div className="mt-3"><SectionActionFieldsDraft action={content.action} allowLeadForm buttonLabel={content.buttonLabel} buttonLabelMax={80} disabled={saving} idBase={`contact-${section.id}`} onChange={({ buttonLabel, action }) => onChange({ ...content, buttonLabel, action })} /></div>
      </div>

      {validationError && <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
    </section>
  )
}
