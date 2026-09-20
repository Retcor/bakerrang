'use client'
/* eslint-disable @next/next/no-img-element */

import type { LogosContent, LogosSection } from '@bakerrang/site-schema'
import { Input } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function LogosIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><rect height="7" rx="1.5" width="8" x="3" y="4" /><rect height="7" rx="1.5" width="8" x="13" y="4" /><rect height="7" rx="1.5" width="8" x="8" y="13" /></svg>
}

function MoveUpIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="m6 15 6-6 6 6" /></svg>
}

function MoveDownIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
}

function RemoveIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" /></svg>
}

function AddIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
}

function WarningIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
}

export function logosContentError (content: LogosContent): string | null {
  if ((content.heading?.trim().length ?? 0) > 120) return 'Section heading must be 120 characters or fewer.'
  if (content.items.length > 24) return 'Logos cannot exceed 24 items.'
  if (content.items.some((item) => !item.mediaId.trim())) return 'Every logo needs a media reference.'
  if (new Set(content.items.map((item) => item.mediaId)).size !== content.items.length) return 'Logos cannot contain the same image twice.'
  if (content.items.some((item) => !item.altText.trim())) return 'Every logo needs alt text.'
  if (content.items.some((item) => item.altText.trim().length > 250)) return 'Alt text must be 250 characters or fewer.'
  return null
}

export function LogosDraftInspector ({ onChange, onOpenMediaPicker, saving, section }: {
  section: LogosSection
  onChange: (content: LogosContent) => void
  onOpenMediaPicker: () => void
  saving: boolean
}) {
  const { content } = section
  const heading = content.heading ?? ''
  const validationError = logosContentError(content)
  const moveItem = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= content.items.length) return
    const items = [...content.items]
    ;[items[index], items[nextIndex]] = [items[nextIndex]!, items[index]!]
    onChange({ ...content, items })
  }

  return (
    <section aria-label="Logos properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><LogosIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Logos</h2><p className="mt-0.5 text-xs text-fg-subtle">Show organizations, partners, or brands you work with.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`logos-heading-${section.id}`}>Section heading <span className="font-normal text-fg-muted">Optional</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{heading.length} / 120</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`logos-heading-${section.id}`} maxLength={120} onChange={(event) => onChange({ ...content, heading: event.target.value })} value={heading} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Logos</h3>
        <span className="text-xs font-semibold tabular-nums text-fg-subtle">{content.items.length} of 24</span>
      </div>

      {content.items.length === 0
        ? <div className="mt-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-5 text-center"><p className="text-[0.8125rem] font-semibold text-fg">No logos yet</p><p className="mt-1 text-xs leading-5 text-fg-subtle">This section stays hidden on your site until you add a logo.</p></div>
        : <ol aria-label="Logos" className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          {content.items.map((item, index) => (
            <li className={index === 0 ? 'grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 p-3' : 'grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 border-t border-border p-3'} key={item.id}>
              {item.src
                ? <img alt="" className="aspect-[4/3] w-full rounded-md border border-border bg-surface-muted object-contain p-1" height={item.height} loading="lazy" src={item.src} width={item.width} />
                : <span aria-hidden className="aspect-[4/3] w-full rounded-md border border-border bg-surface-muted" />}
              <div className="min-w-0">
                <label className="text-xs font-semibold text-fg" htmlFor={`logo-alt-${section.id}-${item.id}`}>Alt text <span className="text-danger-fg">*</span></label>
                <Input className="mt-1" disabled={saving} id={`logo-alt-${section.id}-${item.id}`} maxLength={250} onChange={(event) => onChange({ ...content, items: content.items.map((candidate) => candidate.id === item.id ? { ...candidate, altText: event.target.value } : candidate) })} placeholder="Describe this logo" value={item.altText} />
                {!item.altText.trim() && <p className="mt-1 text-xs text-warning-fg">Add alt text so this logo can be saved.</p>}
                <div className="mt-2 flex items-center gap-0.5">
                  <span className="text-xs font-bold uppercase tracking-[0.02em] text-fg-subtle">Logo {index + 1}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button aria-label={`Move logo ${index + 1} up`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === 0} onClick={() => moveItem(index, -1)} title="Move up" type="button"><MoveUpIcon /></button>
                    <button aria-label={`Move logo ${index + 1} down`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === content.items.length - 1} onClick={() => moveItem(index, 1)} title="Move down" type="button"><MoveDownIcon /></button>
                    <button aria-label={`Remove logo ${index + 1} from Logos`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-30" disabled={saving} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })} title="Remove from Logos" type="button"><RemoveIcon /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>}

      {validationError && <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
      <button className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving || content.items.length >= 24} onClick={onOpenMediaPicker} type="button"><AddIcon />Add logo</button>
      {content.items.length >= 24 && <p className="mt-1.5 text-center text-xs text-fg-subtle">Maximum of 24 logos.</p>}
    </section>
  )
}
