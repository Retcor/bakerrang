'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, isBusinessHoursSection, type BusinessHours, type DayHours, type SiteDefinition, type WeekdayKey } from '@bakerrang/site-schema'
import { Button, ConfirmDialog, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateBusinessHours } from '../../lib/site'
import { WebsiteEditorShell } from './WebsiteEditorShell'

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

export function BusinessHoursEditor ({ onCancel, onDirtyChange = () => {}, onSaved, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const section = findHomePage(site)?.sections.find(isBusinessHoursSection)
  const configured = Boolean(site.businessProfile?.businessHours)
  const [week, setWeek] = useState(() => editableWeek(site.businessProfile?.businessHours))
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
          : { enabled: Boolean(section), ...(section?.content.heading ? { heading: section.content.heading } : {}), ...(section?.content.intro ? { intro: section.content.intro } : {}) }
      }, section?.id))
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
    void save(canonicalWeek(week))
  }

  return (
    <>
      <WebsiteEditorShell dirtyValue={{ businessHours: canonicalWeek(week) }} editor="businessHours" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={submit} saving={saving} width="wide" secondaryActions={configured && <Button disabled={saving} onClick={() => setConfirmRemove(true)} type="button" variant="danger">Remove business hours</Button>}>
        <p className="text-sm leading-6 text-fg-muted">Set the weekly schedule used across your site and in search results. Homepage presence and presentation are managed from Homepage.</p>
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

      </WebsiteEditorShell>
      <ConfirmDialog busy={saving} confirmLabel="Remove hours" description="This removes the weekly schedule. The homepage Business Hours section is also removed because it cannot display without a schedule. Your published site will not change until you republish." onCancel={() => setConfirmRemove(false)} onConfirm={() => void save(null)} open={confirmRemove} title="Remove business hours?" />
    </>
  )
}
