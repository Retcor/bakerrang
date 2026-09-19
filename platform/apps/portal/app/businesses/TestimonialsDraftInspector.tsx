'use client'

import type { TestimonialsContent, TestimonialsSection } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function TestimonialsIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><path d="M5 6h6v6H7l-2 3V6Zm8 0h6v6h-4l-2 3V6Z" /></svg>
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

export function testimonialsContentError (content: TestimonialsContent): string | null {
  if (!content.title.trim()) return 'Section heading is required.'
  if (content.title.trim().length > 100) return 'Section heading must be 100 characters or fewer.'
  if (content.items.length === 0) return 'Add at least one testimonial.'
  if (content.items.length > 10) return 'Testimonials cannot exceed 10 items.'
  if (content.items.some((item) => !item.customerName.trim())) return 'Every testimonial needs a customer name.'
  if (content.items.some((item) => item.customerName.trim().length > 120)) return 'Customer names must be 120 characters or fewer.'
  if (content.items.some((item) => !item.quote.trim())) return 'Every testimonial needs a quote.'
  if (content.items.some((item) => item.quote.trim().length > 1000)) return 'Testimonial quotes must be 1000 characters or fewer.'
  return null
}

export function TestimonialsDraftInspector ({ section, onChange, saving }: {
  section: TestimonialsSection
  onChange: (content: TestimonialsContent) => void
  saving: boolean
}) {
  const { content } = section
  const validationError = testimonialsContentError(content)
  const updateItem = (id: string, patch: Partial<Pick<TestimonialsContent['items'][number], 'customerName' | 'quote'>>) => {
    onChange({ ...content, items: content.items.map((item) => item.id === id ? { ...item, ...patch } : item) })
  }
  const moveItem = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= content.items.length) return
    const items = [...content.items]
    ;[items[index], items[nextIndex]] = [items[nextIndex]!, items[index]!]
    onChange({ ...content, items })
  }
  const addTestimonial = () => {
    if (saving || content.items.length >= 10) return
    onChange({ ...content, items: [...content.items, { id: crypto.randomUUID(), customerName: '', quote: '' }] })
  }

  return (
    <section aria-label="Testimonials properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><TestimonialsIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Testimonials</h2><p className="mt-0.5 text-xs text-fg-subtle">Customer quotes that build trust.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`testimonials-title-${section.id}`}>Section heading</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.title.length} / 100</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`testimonials-title-${section.id}`} maxLength={100} onChange={(event) => onChange({ ...content, title: event.target.value })} value={content.title} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Testimonial items</h3>
        <span className="text-xs font-semibold tabular-nums text-fg-subtle">{content.items.length} of 10</span>
      </div>

      {content.items.length === 0
        ? <div className="mt-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-5 text-center"><p className="text-[0.8125rem] font-semibold text-fg">No testimonials yet</p><p className="mt-1 text-xs leading-5 text-fg-subtle">Add a testimonial to show this section on your site.</p></div>
        : <ol aria-label="Testimonial items" className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          {content.items.map((item, index) => {
            const itemLabel = item.customerName.trim() || `Testimonial ${index + 1}`
            return (
              <li className={index === 0 ? 'px-3 pb-3 pt-3' : 'border-t border-border px-3 pb-3 pt-3'} key={item.id}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.02em] text-fg-subtle">Testimonial {index + 1}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button aria-label={`Move ${itemLabel} up`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === 0} onClick={() => moveItem(index, -1)} title="Move up" type="button"><MoveUpIcon /></button>
                    <button aria-label={`Move ${itemLabel} down`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === content.items.length - 1} onClick={() => moveItem(index, 1)} title="Move down" type="button"><MoveDownIcon /></button>
                    <button aria-label={`Remove ${itemLabel}`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-30" disabled={saving} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })} title="Remove" type="button"><RemoveIcon /></button>
                  </div>
                </div>
                <div className="mt-2.5">
                  <label className="text-xs font-semibold text-fg" htmlFor={`testimonial-name-${section.id}-${item.id}`}>Customer name</label>
                  <Input className="mt-1" disabled={saving} id={`testimonial-name-${section.id}-${item.id}`} maxLength={120} onChange={(event) => updateItem(item.id, { customerName: event.target.value })} value={item.customerName} />
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="text-xs font-semibold text-fg" htmlFor={`testimonial-quote-${section.id}-${item.id}`}>Quote</label>
                    <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{item.quote.length} / 1000</span>
                  </div>
                  <Textarea className="mt-1 min-h-24 resize-y" disabled={saving} id={`testimonial-quote-${section.id}-${item.id}`} maxLength={1000} onChange={(event) => updateItem(item.id, { quote: event.target.value })} value={item.quote} />
                </div>
              </li>
            )
          })}
        </ol>}

      {validationError && <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
      <button className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving || content.items.length >= 10} onClick={addTestimonial} type="button"><AddIcon />Add testimonial</button>
      {content.items.length >= 10 && <p className="mt-1.5 text-center text-xs text-fg-subtle">Maximum of 10 testimonials.</p>}
    </section>
  )
}
