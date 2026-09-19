'use client'

import type { FaqContent, FaqSection } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

function FaqIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9a2.7 2.7 0 0 1 5 1.4c0 1.8-2.5 2-2.5 4M12 17h.01" /></svg>
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

export function faqContentError (content: FaqContent): string | null {
  if (!content.heading.trim()) return 'Section heading is required.'
  if (content.heading.trim().length > 120) return 'Section heading must be 120 characters or fewer.'
  if ((content.intro?.trim().length ?? 0) > 300) return 'Intro must be 300 characters or fewer.'
  if (content.items.length === 0) return 'Add at least one question.'
  if (content.items.length > 20) return 'FAQ cannot exceed 20 questions.'
  if (content.items.some((item) => !item.question.trim())) return 'Every FAQ item needs a question.'
  if (content.items.some((item) => item.question.trim().length > 200)) return 'Questions must be 200 characters or fewer.'
  if (content.items.some((item) => !item.answer.trim())) return 'Every question needs an answer.'
  if (content.items.some((item) => item.answer.trim().length > 1000)) return 'Answers must be 1000 characters or fewer.'
  return null
}

export function FaqDraftInspector ({ section, onChange, saving }: {
  section: FaqSection
  onChange: (content: FaqContent) => void
  saving: boolean
}) {
  const { content } = section
  const validationError = faqContentError(content)
  const updateItem = (id: string, patch: Partial<Pick<FaqContent['items'][number], 'question' | 'answer'>>) => {
    onChange({ ...content, items: content.items.map((item) => item.id === id ? { ...item, ...patch } : item) })
  }
  const moveItem = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= content.items.length) return
    const items = [...content.items]
    ;[items[index], items[nextIndex]] = [items[nextIndex]!, items[index]!]
    onChange({ ...content, items })
  }
  const addQuestion = () => {
    if (saving || content.items.length >= 20) return
    onChange({ ...content, items: [...content.items, { id: crypto.randomUUID(), question: '', answer: '' }] })
  }

  return (
    <section aria-label="FAQ properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><FaqIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">FAQ</h2><p className="mt-0.5 text-xs text-fg-subtle">Answers to common questions.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`faq-heading-${section.id}`}>Section heading</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{content.heading.length} / 120</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`faq-heading-${section.id}`} maxLength={120} onChange={(event) => onChange({ ...content, heading: event.target.value })} value={content.heading} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`faq-intro-${section.id}`}>Intro <span aria-hidden className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.intro ?? '').length} / 300</span>
        </div>
        <Textarea aria-label="Intro" className="mt-1.5 min-h-20 resize-y" disabled={saving} id={`faq-intro-${section.id}`} maxLength={300} onChange={(event) => onChange({ ...content, intro: event.target.value })} value={content.intro ?? ''} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Questions</h3>
        <span className="text-xs font-semibold tabular-nums text-fg-subtle">{content.items.length} of 20</span>
      </div>

      {content.items.length === 0
        ? <div className="mt-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-3 py-5 text-center"><p className="text-[0.8125rem] font-semibold text-fg">No questions yet</p><p className="mt-1 text-xs leading-5 text-fg-subtle">Add a question to show this section on your site.</p></div>
        : <ol aria-label="Questions" className="mt-2 overflow-hidden rounded-md border border-border bg-surface">
          {content.items.map((item, index) => {
            const itemLabel = item.question.trim() || `Question ${index + 1}`
            return (
              <li className={index === 0 ? 'px-3 pb-3 pt-3' : 'border-t border-border px-3 pb-3 pt-3'} key={item.id}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.02em] text-fg-subtle">Question {index + 1}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button aria-label={`Move ${itemLabel} up`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === 0} onClick={() => moveItem(index, -1)} title="Move up" type="button"><MoveUpIcon /></button>
                    <button aria-label={`Move ${itemLabel} down`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-30" disabled={saving || index === content.items.length - 1} onClick={() => moveItem(index, 1)} title="Move down" type="button"><MoveDownIcon /></button>
                    <button aria-label={`Remove ${itemLabel}`} className="grid size-[1.875rem] place-items-center rounded-md text-fg-muted transition-colors hover:bg-danger-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-30" disabled={saving} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })} title="Remove" type="button"><RemoveIcon /></button>
                  </div>
                </div>
                <div className="mt-2.5">
                  <label className="text-xs font-semibold text-fg" htmlFor={`faq-question-${section.id}-${item.id}`}>Question</label>
                  <Input className="mt-1" disabled={saving} id={`faq-question-${section.id}-${item.id}`} maxLength={200} onChange={(event) => updateItem(item.id, { question: event.target.value })} value={item.question} />
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <label className="text-xs font-semibold text-fg" htmlFor={`faq-answer-${section.id}-${item.id}`}>Answer</label>
                    <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{item.answer.length} / 1000</span>
                  </div>
                  <Textarea className="mt-1 min-h-24 resize-y" disabled={saving} id={`faq-answer-${section.id}-${item.id}`} maxLength={1000} onChange={(event) => updateItem(item.id, { answer: event.target.value })} value={item.answer} />
                </div>
              </li>
            )
          })}
        </ol>}

      {validationError && <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}
      <button className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-info-fg transition-colors hover:border-focus hover:bg-info-subtle disabled:cursor-not-allowed disabled:border-solid disabled:border-border disabled:bg-surface-muted disabled:text-fg-subtle" disabled={saving || content.items.length >= 20} onClick={addQuestion} type="button"><AddIcon />Add question</button>
      {content.items.length >= 20 && <p className="mt-1.5 text-center text-xs text-fg-subtle">Maximum of 20 questions.</p>}
    </section>
  )
}
