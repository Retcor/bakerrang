'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, isBusinessHoursSection, type BusinessHours, type DayHours, type SiteDefinition, type WeekdayKey } from '@bakerrang/site-schema'
import { Button, ConfirmDialog, Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateBusinessHours } from '../../lib/site'

const weekdays: ReadonlyArray<{ key: WeekdayKey, label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' }, { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
]

type EditableDay = { closed: boolean, open: string, close: string }
type EditableWeek = Record<WeekdayKey, EditableDay>

const defaultWeek = (): EditableWeek => Object.fromEntries(weekdays.map(({ key }, index) => [
  key,
  index < 5 ? { closed: false, open: '09:00', close: '17:00' } : { closed: true, open: '09:00', close: '17:00' }
])) as EditableWeek

const editableDay = (day: DayHours): EditableDay => 'closed' in day
  ? { closed: true, open: '09:00', close: '17:00' }
  : { closed: false, open: day.open, close: day.close }

const editableWeek = (hours?: BusinessHours): EditableWeek => hours
  ? Object.fromEntries(weekdays.map(({ key }) => [key, editableDay(hours[key])])) as EditableWeek
  : defaultWeek()

const canonicalWeek = (week: EditableWeek): BusinessHours => Object.fromEntries(
  weekdays.map(({ key }) => [key, week[key].closed
    ? { closed: true }
    : { open: week[key].open, close: week[key].close }])
) as unknown as BusinessHours

export function BusinessHoursEditor ({ onCancel, onSaved, site, tenantId }: {
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const section = findHomePage(site)?.sections.find(isBusinessHoursSection)
  const configured = Boolean(site.businessProfile?.businessHours)
  const [week, setWeek] = useState(() => editableWeek(site.businessProfile?.businessHours))
  const [homepageEnabled, setHomepageEnabled] = useState(Boolean(section))
  const [heading, setHeading] = useState(section?.content.heading ?? '')
  const [intro, setIntro] = useState(section?.content.intro ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDay = (key: WeekdayKey, update: Partial<EditableDay>) => setWeek((current) => ({
    ...current,
    [key]: { ...current[key], ...update }
  }))

  const save = async (businessHours: BusinessHours | null) => {
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateBusinessHours(tenantId, {
        businessHours,
        homepage: businessHours === null
          ? { enabled: false }
          : { enabled: homepageEnabled, ...(heading.trim() ? { heading: heading.trim() } : {}), ...(intro.trim() ? { intro: intro.trim() } : {}) }
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save Business Hours. Please try again.')
    } finally {
      setSaving(false)
      setConfirmRemove(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    for (const { key, label } of weekdays) {
      const day = week[key]
      if (!day.closed && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(day.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.close))) {
        setError(`${label} times must use HH:MM.`)
        return
      }
      if (!day.closed && day.close <= day.open) {
        setError(`${label} closing time must be later than opening time.`)
        return
      }
    }
    if (heading.trim().length > 120) return setError('Section heading must be 120 characters or fewer.')
    if (intro.trim().length > 300) return setError('Intro must be 300 characters or fewer.')
    void save(canonicalWeek(week))
  }

  return (
    <>
      <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" onSubmit={submit}>
        <h2 className="text-lg font-semibold text-fg">Business Hours</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">Set one local opening interval per day. These hours also power search-engine business data.</p>
        {!configured && <p className="mt-3 text-sm text-fg-muted">Weekday defaults are ready to edit and won&apos;t be saved until you choose Save.</p>}

        <div className="mt-5 space-y-3">
          {weekdays.map(({ key, label }) => {
            const day = week[key]
            return (
              <fieldset className="grid min-w-0 gap-3 rounded-md border border-border p-4 sm:grid-cols-[8rem_7rem_minmax(0,1fr)] sm:items-center" disabled={saving} key={key}>
                <legend className="sr-only">{label}</legend>
                <span className="font-semibold text-fg">{label}</span>
                <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-fg">
                  <input aria-label={`${label} open`} checked={!day.closed} className="size-5 accent-[var(--color-accent)]" onChange={(event) => setDay(key, { closed: !event.target.checked })} type="checkbox" />
                  {day.closed ? 'Closed' : 'Open'}
                </label>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <Input aria-label={`${label} opening time`} className="min-w-0" disabled={saving || day.closed} onChange={(event) => setDay(key, { open: event.target.value })} type="time" value={day.open} />
                  <span className="text-sm text-fg-muted">to</span>
                  <Input aria-label={`${label} closing time`} className="min-w-0" disabled={saving || day.closed} onChange={(event) => setDay(key, { close: event.target.value })} type="time" value={day.close} />
                </div>
              </fieldset>
            )
          })}
        </div>

        <Button className="mt-3" disabled={saving} onClick={() => setWeek((current) => ({
          ...current,
          tuesday: { ...current.monday }, wednesday: { ...current.monday },
          thursday: { ...current.monday }, friday: { ...current.monday }
        }))} size="sm" type="button" variant="secondary">Copy Monday to weekdays</Button>

        <fieldset className="mt-6 rounded-md border border-border p-4" disabled={saving}>
          <legend className="px-1 text-sm font-semibold text-fg">Homepage presentation</legend>
          <label className="flex min-h-11 items-center gap-3 font-semibold text-fg">
            <input checked={homepageEnabled} className="size-5 accent-[var(--color-accent)]" onChange={(event) => setHomepageEnabled(event.target.checked)} type="checkbox" />
            Show business hours on homepage
          </label>
          {homepageEnabled && (
            <div className="mt-4 space-y-4">
              <div><label className="text-sm font-semibold text-fg" htmlFor={`hours-heading-${tenantId}`}>Section heading <span className="font-normal text-fg-muted">Optional</span></label><Input className="mt-2" id={`hours-heading-${tenantId}`} maxLength={120} onChange={(event) => setHeading(event.target.value)} placeholder="Business Hours" value={heading} /></div>
              <div><label className="text-sm font-semibold text-fg" htmlFor={`hours-intro-${tenantId}`}>Intro <span className="font-normal text-fg-muted">Optional</span></label><Textarea className="mt-2" id={`hours-intro-${tenantId}`} maxLength={300} onChange={(event) => setIntro(event.target.value)} value={intro} /></div>
            </div>
          )}
        </fieldset>

        {error && <p className="mt-4 text-sm text-fg" role="alert">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <div>{configured && <Button disabled={saving} onClick={() => setConfirmRemove(true)} type="button" variant="danger">Remove business hours</Button>}</div>
          <div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button><Button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Business Hours'}</Button></div>
        </div>
      </form>
      <ConfirmDialog busy={saving} confirmLabel="Remove hours" description="This removes the canonical weekly schedule and its homepage section from the working site. Your published site will not change until you republish." onCancel={() => setConfirmRemove(false)} onConfirm={() => void save(null)} open={confirmRemove} title="Remove business hours?" />
    </>
  )
}
