'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, isContactSection, type ContactAction, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input, Select, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { upsertHomeContact, type ContactActionInput } from '../../lib/site'

type ActionType = ContactAction['type']

export interface ContactEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

const actionDetails: Record<ActionType, { label: string, placeholder?: string, help: string, maxLength?: number }> = {
  email: { label: 'Email', placeholder: 'hello@example.com', help: 'Opens a new email addressed to this address.', maxLength: 254 },
  phone: { label: 'Phone', placeholder: '(801) 555-1234', help: 'Starts a call to this phone number.', maxLength: 50 },
  url: { label: 'Website URL', placeholder: 'https://example.com/contact', help: 'Opens this complete http or https URL.', maxLength: 2048 },
  leadForm: { label: 'Lead Form', help: 'Opens a form where visitors can send their contact details and a message.' }
}

export function ContactEditor ({ tenantId, site, onCancel, onSaved }: ContactEditorProps) {
  const home = findHomePage(site)
  const contact = home?.sections.find(isContactSection)
  const [title, setTitle] = useState(contact?.content.title ?? 'Contact Us')
  const [text, setText] = useState(contact?.content.text ?? '')
  const [buttonLabel, setButtonLabel] = useState(contact?.content.buttonLabel ?? 'Contact Us')
  const [actionType, setActionType] = useState<ActionType>(contact?.content.action.type ?? 'email')
  const [actionValue, setActionValue] = useState(
    contact?.content.action && 'value' in contact.content.action ? contact.content.action.value : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const details = actionDetails[actionType]

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
      onSaved(await upsertHomeContact(tenantId, {
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
    <form className="w-full rounded-lg border border-border bg-surface p-5 text-left shadow-xs sm:p-6" onSubmit={(event) => void handleSubmit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor={`contact-title-${tenantId}`}>Section Heading</label>
      <Input className="mt-2" disabled={saving} id={`contact-title-${tenantId}`} maxLength={150} onChange={(event) => setTitle(event.target.value)} value={title} />

      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`contact-text-${tenantId}`}>Supporting Text</label>
      <Textarea className="mt-2 min-h-24" disabled={saving} id={`contact-text-${tenantId}`} maxLength={500} onChange={(event) => setText(event.target.value)} value={text} />

      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`contact-button-${tenantId}`}>Button Label</label>
      <Input className="mt-2" disabled={saving} id={`contact-button-${tenantId}`} maxLength={80} onChange={(event) => setButtonLabel(event.target.value)} value={buttonLabel} />

      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`contact-type-${tenantId}`}>Action Type</label>
      <Select className="mt-2" disabled={saving} id={`contact-type-${tenantId}`} onChange={(event) => { setActionType(event.target.value as ActionType); setActionValue('') }} value={actionType}>
        {(Object.keys(actionDetails) as ActionType[]).map((type) => <option key={type} value={type}>{actionDetails[type].label}</option>)}
      </Select>

      {actionType !== 'leadForm' && (
        <>
          <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`contact-value-${tenantId}`}>Action Value</label>
          <Input className="mt-2" disabled={saving} id={`contact-value-${tenantId}`} maxLength={details.maxLength} onChange={(event) => setActionValue(event.target.value)} placeholder={details.placeholder} value={actionValue} />
        </>
      )}
      <p className="mt-2 text-xs text-fg-muted">{details.help}</p>

      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">Cancel</Button>
        <Button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </form>
  )
}
