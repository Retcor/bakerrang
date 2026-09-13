'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button, Card, Input, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import {
  getLeadNotificationSettings,
  updateLeadNotificationSettings,
  type LeadNotificationSettings
} from '../../lib/leadNotifications'
import { useBusinessNavigationGuard } from './BusinessNavigationGuard'

const comparable = (value: LeadNotificationSettings) => JSON.stringify(value)

export function LeadNotificationSettings ({ tenantId }: { tenantId: string }) {
  const [settings, setSettings] = useState<LeadNotificationSettings | null>(null)
  const [baseline, setBaseline] = useState<LeadNotificationSettings | null>(null)
  const [candidate, setCandidate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = useMemo(() => Boolean(settings && baseline && comparable(settings) !== comparable(baseline)), [baseline, settings])
  useBusinessNavigationGuard(dirty)

  useEffect(() => {
    let cancelled = false
    void getLeadNotificationSettings(tenantId).then((next) => {
      if (!cancelled) { setSettings(next); setBaseline(next) }
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Lead notification settings could not be loaded.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tenantId])

  const addRecipient = () => {
    const email = candidate.trim().toLowerCase()
    if (!email || !settings) return
    if (settings.recipients.includes(email)) return setError('That recipient is already listed.')
    setSettings({ ...settings, recipients: [...settings.recipients, email] })
    setCandidate(''); setError(null)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!settings || saving) return
    setSaving(true); setError(null)
    try {
      const authoritative = await updateLeadNotificationSettings(tenantId, {
        enabled: settings.enabled,
        recipients: settings.recipients
      })
      setSettings(authoritative); setBaseline(authoritative); setCandidate('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Lead notification settings could not be saved. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <Card className="mt-6 max-w-3xl p-5 text-left sm:p-6" aria-labelledby="lead-notifications-title">
      <h2 className="text-lg font-semibold text-fg" id="lead-notifications-title">Lead notifications</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">These addresses receive new website-lead emails.</p>
      <p className="mt-1 text-sm leading-6 text-fg-muted">If no custom recipient is entered, the Business Profile email is used.</p>
      <p className="mt-1 text-sm leading-6 text-fg-muted">Disabling notifications does not disable website lead capture.</p>
      {loading && <p className="mt-4 text-sm text-fg-muted" role="status">Loading notification settings…</p>}
      {!loading && !settings && error && <StatusMessage tone="error">{error}</StatusMessage>}
      {!loading && settings && (
        <form className="mt-5" noValidate onSubmit={(event) => void save(event)}>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-fg" htmlFor={`lead-notifications-enabled-${tenantId}`}>
            <input checked={settings.enabled} disabled={saving} id={`lead-notifications-enabled-${tenantId}`} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} type="checkbox" />
            Enable lead email notifications
          </label>
          <fieldset className="mt-5 rounded-md border border-border p-4" disabled={saving}>
            <legend className="px-1 text-sm font-semibold text-fg">Recipient email list</legend>
            {settings.recipients.length === 0 && <p className="text-sm text-fg-muted">No custom recipients. The Business Profile email will be used when available.</p>}
            <ul className="space-y-2" aria-label="Notification recipients">
              {settings.recipients.map((email) => <li className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2 text-sm text-fg" key={email}><span className="break-all">{email}</span><Button aria-label={`Remove ${email}`} onClick={() => setSettings({ ...settings, recipients: settings.recipients.filter((value) => value !== email) })} size="sm" type="button" variant="secondary">Remove</Button></li>)}
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Recipient email" disabled={saving} maxLength={254} onChange={(event) => setCandidate(event.target.value)} placeholder="name@example.com" type="email" value={candidate} />
              <Button disabled={saving || !candidate.trim()} onClick={addRecipient} type="button" variant="secondary">Add recipient</Button>
            </div>
          </fieldset>
          {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
          <div className="mt-5 flex justify-end"><Button disabled={saving || !dirty} type="submit">{saving ? 'Saving…' : 'Save'}</Button></div>
        </form>
      )}
    </Card>
  )
}
