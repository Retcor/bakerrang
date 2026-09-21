'use client'
/* eslint-disable @next/next/no-img-element */

import type { AboutContent, AboutSection, LinkAction } from '@bakerrang/site-schema'
import { Input, Select, Textarea } from '@bakerrang/ui'
import { SectionActionFieldsDraft } from './SectionActionFieldsDraft'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function AboutIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" /><path d="M5 20c1.3-4 4-6 7-6s5.7 2 7 6" /></svg>
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

const emailPattern = /^[A-Za-z0-9.!$%&'*+=^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

function linkActionError (action: LinkAction | undefined): string | null {
  const type = action?.type ?? 'url'
  const value = action?.value.trim() ?? ''
  if (!value) {
    if (type === 'email') return 'Add an email address, or remove the button.'
    if (type === 'phone') return 'Add a phone number, or remove the button.'
    return 'Add a website URL, or remove the button.'
  }
  if (type === 'email') {
    if (value.length > 254) return 'Email address must be 254 characters or fewer.'
    if (!emailPattern.test(value)) return 'Enter a valid email address, or remove the button.'
    return null
  }
  if (type === 'phone') {
    if (value.length > 50) return 'Phone number must be 50 characters or fewer.'
    const dialDigits = value.replace(/[()\-.\s]/g, '')
    if (!/^\+?[\d()\-.\s]+$/.test(value) || !/^\+?\d{7,15}$/.test(dialDigits)) return 'Enter a valid phone number, or remove the button.'
    return null
  }
  if (value.length > 2048) return 'Website URL must be 2048 characters or fewer.'
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'Enter a valid website URL using http or https, or remove the button.'
  } catch {
    return 'Enter a valid website URL using http or https, or remove the button.'
  }
  return null
}

export function aboutContentError (content: AboutContent): string | null {
  if (!content.heading.trim()) return 'Heading is required.'
  if (content.heading.trim().length > 120) return 'Heading must be 120 characters or fewer.'
  if (!content.body.trim()) return 'Body is required.'
  if (content.body.trim().length > 2000) return 'Body must be 2000 characters or fewer.'
  if ((content.eyebrow?.trim().length ?? 0) > 60) return 'Eyebrow must be 60 characters or fewer.'
  if (content.imageMediaId && !content.imageAlt?.trim()) return 'Add alt text for the About image, or remove it.'
  if (content.imageMediaId && (content.imageAlt?.trim().length ?? 0) > 250) return 'Image alt text must be 250 characters or fewer.'

  const configured = content.buttonLabel !== undefined || content.action !== undefined
  if (!configured) return null
  if (!content.buttonLabel?.trim()) return 'Add a button label, or remove the button.'
  if (content.buttonLabel.trim().length > 60) return 'Button label must be 60 characters or fewer.'
  return linkActionError(content.action)
}

export function AboutDraftInspector ({ onChange, onOpenMediaPicker, saving, section }: {
  section: AboutSection
  onChange: (content: AboutContent) => void
  onOpenMediaPicker: () => void
  saving: boolean
}) {
  const { content } = section
  const configured = content.buttonLabel !== undefined || content.action !== undefined
  const action: LinkAction = content.action ?? { type: 'url', value: '' }
  const validationError = aboutContentError(content)

  const removeImage = () => {
    if (saving) return
    const next = { ...content }
    delete next.imageMediaId
    delete next.imageAlt
    delete next.imageSrc
    delete next.imageWidth
    delete next.imageHeight
    delete next.imagePosition
    onChange(next)
  }
  const addButton = () => {
    if (saving) return
    onChange({ ...content, buttonLabel: '', action: { type: 'url', value: '' } })
  }
  const removeButton = () => {
    if (saving) return
    const next = { ...content }
    delete next.buttonLabel
    delete next.action
    onChange(next)
  }

  return (
    <section aria-label="About properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><AboutIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">About</h2><p className="mt-0.5 text-xs text-fg-subtle">Tell visitors what makes this business distinct.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`about-eyebrow-${section.id}`}>Eyebrow <span className="font-normal text-fg-muted">Optional</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.eyebrow ?? '').length} / 60</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`about-eyebrow-${section.id}`} maxLength={60} onChange={(event) => onChange({ ...content, eyebrow: event.target.value })} value={content.eyebrow ?? ''} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`about-heading-${section.id}`}>Heading</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.heading.length} / 120</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`about-heading-${section.id}`} maxLength={120} onChange={(event) => onChange({ ...content, heading: event.target.value })} required value={content.heading} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`about-body-${section.id}`}>Body</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.body.length} / 2000</span>
        </div>
        <Textarea className="mt-1.5 min-h-32 resize-y" disabled={saving} id={`about-body-${section.id}`} maxLength={2000} onChange={(event) => onChange({ ...content, body: event.target.value })} required value={content.body} />
        <p className="mt-1.5 text-xs leading-5 text-fg-subtle">Use a blank line to start a new paragraph.</p>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">About image</h3>
        {!content.imageMediaId
          ? <button className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving} onClick={onOpenMediaPicker} type="button"><AddIcon />Add image</button>
          : <div className="mt-3">
            {content.imageSrc
              ? <img alt="" className="aspect-[4/3] w-full rounded-md border border-border bg-surface-muted object-cover" height={content.imageHeight} src={content.imageSrc} width={content.imageWidth} />
              : <span aria-hidden className="block aspect-[4/3] w-full rounded-md border border-border bg-surface-muted" />}
            <div className="mt-3">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`about-image-alt-${section.id}`}>Image alt text</label>
                <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.imageAlt ?? '').length} / 250</span>
              </div>
              <Input className="mt-1.5" disabled={saving} id={`about-image-alt-${section.id}`} maxLength={250} onChange={(event) => onChange({ ...content, imageAlt: event.target.value })} placeholder="Describe this image" required value={content.imageAlt ?? ''} />
              {!content.imageAlt?.trim() && <p className="mt-1 text-xs text-warning-fg">Add alt text to show this image in the site preview.</p>}
            </div>
            <div className="mt-4">
              <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`about-image-position-${section.id}`}>Image position</label>
              <Select className="mt-1.5" disabled={saving} id={`about-image-position-${section.id}`} onChange={(event) => onChange({ ...content, imagePosition: event.target.value as 'left' | 'right' })} value={content.imagePosition ?? 'left'}><option value="left">Left</option><option value="right">Right</option></Select>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} onClick={onOpenMediaPicker} type="button">Change image</button>
              <button className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} onClick={removeImage} type="button"><RemoveIcon />Remove image</button>
            </div>
          </div>}
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
        : <div className="mt-3"><SectionActionFieldsDraft action={action} buttonLabel={content.buttonLabel ?? ''} buttonLabelMax={60} disabled={saving} idBase={`about-${section.id}`} onChange={({ buttonLabel, action: nextAction }) => onChange({ ...content, buttonLabel, action: nextAction })} /></div>}

      {validationError && <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
    </section>
  )
}
