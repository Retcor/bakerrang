'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, isBusinessHoursSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSectionContent } from '../../lib/site'
import { WebsiteEditorShell } from './WebsiteEditorShell'

export function BusinessHoursSectionEditor ({ onCancel, onDirtyChange = () => {}, onSaved, sectionId, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  sectionId: string
  site: SiteDefinition
  tenantId: string
}) {
  const selectedSection = findHomePage(site)?.sections.find((candidate) => candidate.id === sectionId)
  const section = selectedSection && isBusinessHoursSection(selectedSection) ? selectedSection : undefined
  const [heading, setHeading] = useState(section?.content.heading ?? '')
  const [intro, setIntro] = useState(section?.content.intro ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!section) return <p className="max-w-80 text-sm text-fg" role="alert">The selected Business Hours section is unavailable.</p>

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (heading.trim().length > 120) return setError('Section heading must be 120 characters or fewer.')
    if (intro.trim().length > 300) return setError('Intro must be 300 characters or fewer.')
    setSaving(true); setError(null)
    try {
      onSaved(await updateSectionContent(tenantId, sectionId, {
        ...(heading.trim() ? { heading: heading.trim() } : {}),
        ...(intro.trim() ? { intro: intro.trim() } : {})
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400 ? caught.message : 'Unable to save Business Hours presentation. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <WebsiteEditorShell dirtyValue={{ heading: heading.trim(), intro: intro.trim() }} editor="businessHoursSection" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving}>
      <p className="text-sm leading-6 text-fg-muted">Edit how the schedule appears on the homepage. Weekly hours are managed in Site setup.</p>
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`hours-heading-${tenantId}`}>Section heading <span className="font-normal text-fg-muted">Optional</span></label>
      <Input className="mt-2" disabled={saving} id={`hours-heading-${tenantId}`} maxLength={120} onChange={(event) => setHeading(event.target.value)} placeholder="Business Hours" value={heading} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor={`hours-intro-${tenantId}`}>Intro <span className="font-normal text-fg-muted">Optional</span></label>
      <Textarea className="mt-2" disabled={saving} id={`hours-intro-${tenantId}`} maxLength={300} onChange={(event) => setIntro(event.target.value)} value={intro} />
    </WebsiteEditorShell>
  )
}
