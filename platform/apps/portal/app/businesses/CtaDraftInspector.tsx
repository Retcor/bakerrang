'use client'

import type { CtaContent, CtaSection, LinkAction } from '@bakerrang/site-schema'
import { Input, Select, Textarea } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

const destinationFields: Record<LinkAction['type'], { label: string, maxLength: number, inputMode: 'email' | 'tel' | 'url', placeholder: string }> = {
  url: { label: 'Website URL', maxLength: 2048, inputMode: 'url', placeholder: 'https://example.com' },
  email: { label: 'Email address', maxLength: 254, inputMode: 'email', placeholder: 'hello@example.com' },
  phone: { label: 'Phone number', maxLength: 50, inputMode: 'tel', placeholder: '(801) 555-1234' }
}

function CtaIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4V5Z" /><path d="M8.5 9.5h7" /></svg>
}

function AddIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
}

function RemoveIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
}

function WarningIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
}

export function ctaContentError (content: CtaContent): string | null {
  if (!content.heading.trim()) return 'Heading is required.'
  if (content.heading.trim().length > 120) return 'Heading must be 120 characters or fewer.'
  if ((content.body?.trim().length ?? 0) > 300) return 'Body must be 300 characters or fewer.'

  const configured = content.buttonLabel !== undefined || content.action !== undefined
  if (!configured) return null
  if (!content.buttonLabel?.trim()) return 'Add a button label, or remove the button.'
  const actionType = content.action?.type ?? 'url'
  if (!content.action?.value.trim()) {
    if (actionType === 'email') return 'Add an email address, or remove the button.'
    if (actionType === 'phone') return 'Add a phone number, or remove the button.'
    return 'Add a website URL, or remove the button.'
  }
  return null
}

export function CtaDraftInspector ({ section, onChange, saving }: {
  section: CtaSection
  onChange: (content: CtaContent) => void
  saving: boolean
}) {
  const { content } = section
  const configured = content.buttonLabel !== undefined || content.action !== undefined
  const action: LinkAction = content.action ?? { type: 'url', value: '' }
  const destination = destinationFields[action.type]
  const validationError = ctaContentError(content)

  const addButton = () => {
    if (saving) return
    onChange({ ...content, buttonLabel: '', action: { type: 'url', value: '' } })
  }
  const removeButton = () => {
    if (saving) return
    const withoutButton: CtaContent = { heading: content.heading, ...(content.body !== undefined ? { body: content.body } : {}) }
    onChange(withoutButton)
  }

  return (
    <section aria-label="Call to Action properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><CtaIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Call to Action</h2><p className="mt-0.5 text-xs text-fg-subtle">Invite visitors to take the next step.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`cta-heading-${section.id}`}>Heading</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.heading.length} / 120</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`cta-heading-${section.id}`} maxLength={120} onChange={(event) => onChange({ ...content, heading: event.target.value })} value={content.heading} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`cta-body-${section.id}`}>Body <span aria-hidden className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.body ?? '').length} / 300</span>
        </div>
        <Textarea aria-label="Body" className="mt-1.5 min-h-16 resize-y" disabled={saving} id={`cta-body-${section.id}`} maxLength={300} onChange={(event) => onChange({ ...content, body: event.target.value })} value={content.body ?? ''} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Button</h3>
        {configured && <button className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} onClick={removeButton} type="button"><RemoveIcon />Remove</button>}
      </div>

      {!configured
        ? <>
          <p className="mt-2 text-xs leading-5 text-fg-subtle">Optional — add a button to give visitors one clear action.</p>
          <button className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving} onClick={addButton} type="button"><AddIcon />Add a button</button>
        </>
        : <div className="mt-3 space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`cta-button-label-${section.id}`}>Button label</label>
              <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.buttonLabel ?? '').length} / 60</span>
            </div>
            <Input className="mt-1.5" disabled={saving} id={`cta-button-label-${section.id}`} maxLength={60} onChange={(event) => onChange({ ...content, buttonLabel: event.target.value, action })} value={content.buttonLabel ?? ''} />
          </div>
          <div>
            <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`cta-action-type-${section.id}`}>Where it goes</label>
            <Select className="mt-1.5" disabled={saving} id={`cta-action-type-${section.id}`} onChange={(event) => onChange({ ...content, buttonLabel: content.buttonLabel ?? '', action: { type: event.target.value as LinkAction['type'], value: '' } })} value={action.type}>
              <option value="url">Website URL</option>
              <option value="email">Email address</option>
              <option value="phone">Phone number</option>
            </Select>
          </div>
          <div>
            <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`cta-action-value-${section.id}`}>{destination.label}</label>
            <Input className="mt-1.5" disabled={saving} id={`cta-action-value-${section.id}`} inputMode={destination.inputMode} maxLength={destination.maxLength} onChange={(event) => onChange({ ...content, buttonLabel: content.buttonLabel ?? '', action: { ...action, value: event.target.value } })} placeholder={destination.placeholder} value={action.value} />
          </div>
        </div>}

      {validationError && <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
    </section>
  )
}
