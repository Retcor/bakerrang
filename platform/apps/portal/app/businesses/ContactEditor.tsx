'use client'

import { useState, type FormEvent } from 'react'
import { isContactSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSectionContent, type ContactActionInput } from '../../lib/site'
import { WebsiteEditorShell } from './WebsiteEditorShell'
import { SectionActionFields, type SectionActionType } from './SectionActionFields'

export interface ContactEditorProps {
  pageId: string
  sectionId: string
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function ContactEditor ({ pageId, sectionId, tenantId, site, onCancel, onDirtyChange = () => {}, onSaved }: ContactEditorProps) {
  const page = site.pages.find((candidate) => candidate.id === pageId)
  const selectedContact = page?.sections.find((section) => section.id === sectionId)
  const contact = selectedContact && isContactSection(selectedContact) ? selectedContact : undefined
  const [title, setTitle] = useState(contact?.content.title ?? 'Contact Us')
  const [text, setText] = useState(contact?.content.text ?? '')
  const [buttonLabel, setButtonLabel] = useState(contact?.content.buttonLabel ?? 'Contact Us')
  const [actionType, setActionType] = useState<SectionActionType>(contact?.content.action.type ?? 'email')
  const [actionValue, setActionValue] = useState(
    contact?.content.action && 'value' in contact.content.action ? contact.content.action.value : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (!title.trim()) return setError('Section heading is required.')
    if (!buttonLabel.trim()) return setError('Button label is required.')
    if (actionType !== 'leadForm' && !actionValue.trim()) return setError('Action value is required.')

    setSaving(true)
    setError(null)
    try {
      const action: ContactActionInput = actionType === 'leadForm'
        ? { type: 'leadForm' }
        : { type: actionType, value: actionValue }
      if (!contact) throw new Error('Contact section is unavailable')
      onSaved(await updateSectionContent(tenantId, pageId, contact.id, {
        title,
        text,
        buttonLabel,
        action
      }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Contact. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WebsiteEditorShell dirtyValue={{ title, text, buttonLabel, actionType, actionValue: actionType === 'leadForm' ? '' : actionValue }} editor="contact" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void handleSubmit(event)} saving={saving}>
      <label className="text-sm font-semibold text-fg" htmlFor={`contact-title-${tenantId}`}>Section Heading</label>
      <Input className="mt-2" disabled={saving} id={`contact-title-${tenantId}`} maxLength={150} onChange={(event) => setTitle(event.target.value)} value={title} />

      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`contact-text-${tenantId}`}>Supporting Text</label>
      <Textarea className="mt-2 min-h-24" disabled={saving} id={`contact-text-${tenantId}`} maxLength={500} onChange={(event) => setText(event.target.value)} value={text} />

      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`contact-button-${tenantId}`}>Button Label</label>
      <Input className="mt-2" disabled={saving} id={`contact-button-${tenantId}`} maxLength={80} onChange={(event) => setButtonLabel(event.target.value)} value={buttonLabel} />

      <SectionActionFields allowLeadForm disabled={saving} id={`contact-${tenantId}`} onTypeChange={setActionType} onValueChange={setActionValue} type={actionType} value={actionValue} />

    </WebsiteEditorShell>
  )
}
