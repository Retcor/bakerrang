'use client'
/* eslint-disable @next/next/no-img-element */

import type { GalleryContent, GallerySection } from '@bakerrang/site-schema'
import { Input } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function GalleryIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><rect height="15" rx="1.5" width="18" x="3" y="4" /><path d="m5 16 4-4 3 3 3-4 4 5M8 8h.01" /></svg>
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

export function galleryContentError (content: GalleryContent): string | null {
  if (!content.title.trim()) return 'Section heading is required.'
  if (content.title.trim().length > 100) return 'Section heading must be 100 characters or fewer.'
  if (content.items.length === 0) return 'Add at least one image.'
  if (content.items.length > 20) return 'Gallery cannot exceed 20 images.'
  if (content.items.some((item) => !item.mediaId.trim())) return 'Every Gallery image needs a media reference.'
  if (new Set(content.items.map((item) => item.mediaId)).size !== content.items.length) return 'Gallery cannot contain the same image twice.'
  if (content.items.some((item) => !item.altText.trim())) return 'Every Gallery image needs alt text.'
  if (content.items.some((item) => item.altText.trim().length > 250)) return 'Alt text must be 250 characters or fewer.'
  return null
}

export function GalleryDraftInspector ({ onChange, onOpenMediaPicker, saving, section }: {
  section: GallerySection
  onChange: (content: GalleryContent) => void
  onOpenMediaPicker: () => void
  saving: boolean
}) {
  const { content } = section
  const validationError = galleryContentError(content)
  const moveItem = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= content.items.length) return
    const items = [...content.items]
    ;[items[index], items[nextIndex]] = [items[nextIndex]!, items[index]!]
    onChange({ ...content, items })
  }

  return (
    <section aria-label="Gallery properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><GalleryIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Gallery</h2><p className="mt-0.5 text-xs text-fg-subtle">Show photos of the business or its work.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`gallery-title-${section.id}`}>Section heading</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.title.length} / 100</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`gallery-title-${section.id}`} maxLength={100} onChange={(event) => onChange({ ...content, title: event.target.value })} value={content.title} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Images</h3>
        <span className="text-xs font-semibold tabular-nums text-fg-subtle">{content.items.length} of 20</span>
      </div>

      {content.items.length === 0
        ? <div className="mt-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-5 text-center"><p className="text-[0.8125rem] font-semibold text-fg">No images yet</p><p className="mt-1 text-xs leading-5 text-fg-subtle">Add an image to show this section on your site.</p></div>
        : <ol aria-label="Gallery images" className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          {content.items.map((item, index) => (
            <li className={index === 0 ? 'grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 p-3' : 'grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 border-t border-border p-3'} key={item.id}>
              {item.src
                ? <img alt="" className="aspect-[4/3] w-full rounded-md border border-border bg-surface-muted object-cover" height={item.height} loading="lazy" src={item.src} width={item.width} />
                : <span aria-hidden className="aspect-[4/3] w-full rounded-md border border-border bg-surface-muted" />}
              <div className="min-w-0">
                <label className="text-xs font-semibold text-fg" htmlFor={`gallery-alt-${section.id}-${item.id}`}>Alt text <span className="text-danger-fg">*</span></label>
                <Input className="mt-1" disabled={saving} id={`gallery-alt-${section.id}-${item.id}`} maxLength={250} onChange={(event) => onChange({ ...content, items: content.items.map((candidate) => candidate.id === item.id ? { ...candidate, altText: event.target.value } : candidate) })} placeholder="Describe this image" value={item.altText} />
                {!item.altText.trim() && <p className="mt-1 text-xs text-warning-fg">Add alt text so this image can be saved.</p>}
                <div className="mt-2 flex items-center gap-0.5">
                  <span className="text-xs font-bold uppercase tracking-[0.02em] text-fg-subtle">Image {index + 1}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button aria-label={`Move image ${index + 1} up`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === 0} onClick={() => moveItem(index, -1)} title="Move up" type="button"><MoveUpIcon /></button>
                    <button aria-label={`Move image ${index + 1} down`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === content.items.length - 1} onClick={() => moveItem(index, 1)} title="Move down" type="button"><MoveDownIcon /></button>
                    <button aria-label={`Remove image ${index + 1} from Gallery`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-30" disabled={saving} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })} title="Remove from Gallery" type="button"><RemoveIcon /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>}

      {validationError && <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
      <button className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving || content.items.length >= 20} onClick={onOpenMediaPicker} type="button"><AddIcon />Add image</button>
      {content.items.length >= 20 && <p className="mt-1.5 text-center text-xs text-fg-subtle">Maximum of 20 images.</p>}
    </section>
  )
}
