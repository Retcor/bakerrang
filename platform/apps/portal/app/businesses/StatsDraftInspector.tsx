'use client'

import type { StatsContent, StatsSection } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function HighlightsIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><path d="M5 19V10M12 19V5M19 19v-7M3 19h18" /></svg>
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

export function statsContentError (content: StatsContent): string | null {
  if ((content.heading?.trim().length ?? 0) > 120) return 'Heading must be 120 characters or fewer.'
  if ((content.intro?.trim().length ?? 0) > 300) return 'Intro must be 300 characters or fewer.'
  if (content.items.length === 0) return 'Add at least one highlight.'
  if (content.items.length > 8) return 'Highlights cannot exceed 8 items.'
  if (content.items.some((item) => !item.value.trim())) return 'Every highlight needs a value.'
  if (content.items.some((item) => item.value.trim().length > 16)) return 'Highlight values must be 16 characters or fewer.'
  if (content.items.some((item) => !item.label.trim())) return 'Every highlight needs a label.'
  if (content.items.some((item) => item.label.trim().length > 60)) return 'Highlight labels must be 60 characters or fewer.'
  return null
}

export function StatsDraftInspector ({ section, onChange, saving }: {
  section: StatsSection
  onChange: (content: StatsContent) => void
  saving: boolean
}) {
  const { content } = section
  const validationError = statsContentError(content)
  const updateItem = (id: string, patch: Partial<Pick<StatsContent['items'][number], 'value' | 'label'>>) => {
    onChange({ ...content, items: content.items.map((item) => item.id === id ? { ...item, ...patch } : item) })
  }
  const moveItem = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= content.items.length) return
    const items = [...content.items]
    ;[items[index], items[nextIndex]] = [items[nextIndex]!, items[index]!]
    onChange({ ...content, items })
  }
  const addHighlight = () => {
    if (saving || content.items.length >= 8) return
    onChange({ ...content, items: [...content.items, { id: crypto.randomUUID(), value: '', label: '' }] })
  }

  return (
    <section aria-label="Highlights properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><HighlightsIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Highlights</h2><p className="mt-0.5 text-xs text-fg-subtle">Concise facts that build visitor confidence.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`stats-heading-${section.id}`}>Heading <span className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.heading ?? '').length} / 120</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`stats-heading-${section.id}`} maxLength={120} onChange={(event) => onChange({ ...content, heading: event.target.value })} value={content.heading ?? ''} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`stats-intro-${section.id}`}>Intro <span className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.intro ?? '').length} / 300</span>
        </div>
        <Textarea className="mt-1.5 min-h-20 resize-y" disabled={saving} id={`stats-intro-${section.id}`} maxLength={300} onChange={(event) => onChange({ ...content, intro: event.target.value })} value={content.intro ?? ''} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Highlights</h3>
        <span className="text-xs font-semibold tabular-nums text-fg-subtle">{content.items.length} of 8 highlights</span>
      </div>

      {content.items.length === 0
        ? <div className="mt-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-5 text-center"><p className="text-[0.8125rem] font-semibold text-fg">No highlights yet</p><p className="mt-1 text-xs leading-5 text-fg-subtle">Add a highlight to show this section on your site.</p></div>
        : <ol aria-label="Highlights" className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          {content.items.map((item, index) => {
            const itemLabel = item.label.trim() || item.value.trim() || `Highlight ${index + 1}`
            const helpId = `stats-value-help-${section.id}-${item.id}`
            return (
              <li className={index === 0 ? 'px-3 pb-3 pt-3' : 'border-t border-border px-3 pb-3 pt-3'} key={item.id}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.02em] text-fg-subtle">Highlight {index + 1}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button aria-label={`Move ${itemLabel} up`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === 0} onClick={() => moveItem(index, -1)} title="Move up" type="button"><MoveUpIcon /></button>
                    <button aria-label={`Move ${itemLabel} down`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === content.items.length - 1} onClick={() => moveItem(index, 1)} title="Move down" type="button"><MoveDownIcon /></button>
                    <button aria-label={`Remove ${itemLabel}`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-30" disabled={saving} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })} title="Remove" type="button"><RemoveIcon /></button>
                  </div>
                </div>
                <div className="mt-2.5">
                  <label className="text-xs font-semibold text-fg" htmlFor={`stats-value-${section.id}-${item.id}`}>Value</label>
                  <Input aria-describedby={helpId} className="mt-1" disabled={saving} id={`stats-value-${section.id}-${item.id}`} maxLength={16} onChange={(event) => updateItem(item.id, { value: event.target.value })} value={item.value} />
                  <p className="mt-1 text-xs leading-5 text-fg-subtle" id={helpId}>Shown large, e.g. 24/7 or 1,200+</p>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold text-fg" htmlFor={`stats-label-${section.id}-${item.id}`}>Label</label>
                  <Input className="mt-1" disabled={saving} id={`stats-label-${section.id}-${item.id}`} maxLength={60} onChange={(event) => updateItem(item.id, { label: event.target.value })} value={item.label} />
                </div>
              </li>
            )
          })}
        </ol>}

      {validationError && <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
      <button className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving || content.items.length >= 8} onClick={addHighlight} type="button"><AddIcon />Add highlight</button>
      {content.items.length >= 8 && <p className="mt-1.5 text-center text-xs text-fg-subtle">Maximum of 8 highlights.</p>}
    </section>
  )
}
