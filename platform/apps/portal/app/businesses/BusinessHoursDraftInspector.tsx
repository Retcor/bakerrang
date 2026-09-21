'use client'

import type { BusinessHours, BusinessHoursContent, BusinessHoursSection, DayHours, WeekdayKey } from '@bakerrang/site-schema'
import { Button, Input, Textarea } from '@bakerrang/ui'

const iconClass = 'size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]'

const weekdays: ReadonlyArray<{ key: WeekdayKey, label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
]

function formatBusinessTime (time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return time
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

function formatDay (day: DayHours): string {
  return 'closed' in day ? 'Closed' : `${formatBusinessTime(day.open)} – ${formatBusinessTime(day.close)}`
}

function ClockIcon () {
  return <svg aria-hidden className="size-[1.125rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
}

function EditIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><path d="m14.5 5.5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /></svg>
}

function InfoIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
}

function WarningIcon () {
  return <svg aria-hidden className={iconClass} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
}

export function businessHoursContentError (content: BusinessHoursContent): string | null {
  if ((content.heading?.trim().length ?? 0) > 120) return 'Section heading must be 120 characters or fewer.'
  if ((content.intro?.trim().length ?? 0) > 300) return 'Intro must be 300 characters or fewer.'
  return null
}

export function BusinessHoursDraftInspector ({ section, hours, onChange, onEditSchedule, saving }: {
  section: BusinessHoursSection
  hours?: BusinessHours
  onChange: (content: BusinessHoursContent) => void
  onEditSchedule: () => void
  saving: boolean
}) {
  const { content } = section
  const validationError = businessHoursContentError(content)

  return (
    <section aria-label="Business Hours properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-fg-muted"><ClockIcon /></span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Business Hours</h2><p className="mt-0.5 text-xs text-fg-subtle">Show your weekly schedule on this page.</p></div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`business-hours-heading-${section.id}`}>Section heading <span className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.heading ?? '').length} / 120</span>
        </div>
        <Input className="mt-1.5" disabled={saving} id={`business-hours-heading-${section.id}`} maxLength={120} onChange={(event) => onChange({ ...content, heading: event.target.value })} value={content.heading ?? ''} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`business-hours-intro-${section.id}`}>Intro <span className="font-normal text-fg-subtle">(optional)</span></label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{(content.intro ?? '').length} / 300</span>
        </div>
        <Textarea className="mt-1.5 min-h-16 resize-y" disabled={saving} id={`business-hours-intro-${section.id}`} maxLength={300} onChange={(event) => onChange({ ...content, intro: event.target.value })} value={content.intro ?? ''} />
      </div>

      {validationError && <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/20 bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning-fg" role="alert"><WarningIcon />{validationError}</div>}

      <div className="mt-6 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">Weekly schedule</h3>
          <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2 py-1 text-xs font-semibold leading-none text-fg-muted">Shared</span>
        </div>

        {hours
          ? <>
            <p className="mt-2 text-xs leading-5 text-fg-subtle">Used across your whole site. Edited in More Settings, not here.</p>
            <dl aria-label="Weekly schedule" className="mt-3 overflow-hidden rounded-md border border-border bg-surface-muted">
              {weekdays.map(({ key, label }, index) => (
                <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 px-3 py-2 ${index === 0 ? '' : 'border-t border-border'}`} key={key}>
                  <dt className="text-[0.8125rem] font-semibold text-fg">{label}</dt>
                  <dd className="text-right text-[0.8125rem] tabular-nums text-fg-muted">{formatDay(hours[key])}</dd>
                </div>
              ))}
            </dl>
          </>
          : <div className="mt-3 flex gap-2 rounded-md border border-info/20 bg-info-subtle px-3 py-2.5 text-xs leading-5 text-info-fg" role="note"><span className="mt-0.5 shrink-0 text-info"><InfoIcon /></span><p><span className="font-semibold text-fg">No weekly schedule is set yet, so this section stays hidden on the public site.</span> Set the hours in More Settings to make it appear.</p></div>}

        <Button className="mt-3" disabled={saving} onClick={onEditSchedule} size="sm" type="button" variant="secondary"><EditIcon />Edit business hours</Button>
      </div>
    </section>
  )
}
