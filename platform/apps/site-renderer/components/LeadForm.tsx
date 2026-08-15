'use client'

import { useState, type FormEvent } from 'react'
import { Button, Input } from '@bakerrang/ui'
import { LeadSubmissionError, submitLead } from '../lib/leads'

export interface LeadFormProps {
  tenantId: string
}

const emailPattern = /^\S+@\S+\.\S+$/
const phoneDial = (value: string) => value.replace(/[()\-.\s]/g, '')

export function LeadForm ({ tenantId }: LeadFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()
    const trimmedMessage = message.trim()
    if (!trimmedName) return setError('Name is required.')
    if (!trimmedEmail && !trimmedPhone) return setError('Enter an email address or phone number.')
    if (trimmedEmail && !emailPattern.test(trimmedEmail)) return setError('Enter a valid email address.')
    if (trimmedPhone && !/^\+?\d{7,15}$/.test(phoneDial(trimmedPhone))) return setError('Enter a valid phone number.')
    if (!trimmedMessage) return setError('Message is required.')

    setPending(true)
    setError(null)
    try {
      await submitLead(tenantId, {
        name: trimmedName,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        message: trimmedMessage,
        website
      })
      setSubmitted(true)
    } catch (caught) {
      setError(caught instanceof LeadSubmissionError
        ? caught.message
        : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-border bg-surface p-6" role="status">
        <h2 className="text-xl font-semibold text-fg">Thanks for reaching out.</h2>
        <p className="mt-2 text-fg-muted">Your message has been sent.</p>
      </div>
    )
  }

  return (
    <form className="rounded-md border border-border bg-surface p-5 sm:p-6" onSubmit={(event) => void handleSubmit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor="lead-name">Name</label>
      <Input autoComplete="name" className="mt-2" disabled={pending} id="lead-name" maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />

      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor="lead-email">Email</label>
      <Input autoComplete="email" className="mt-2" disabled={pending} id="lead-email" maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />

      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor="lead-phone">Phone</label>
      <Input autoComplete="tel" className="mt-2" disabled={pending} id="lead-phone" maxLength={50} onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} />

      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor="lead-message">Message</label>
      <textarea autoComplete="off" className="mt-2 min-h-36 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-fg outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} id="lead-message" maxLength={2000} onChange={(event) => setMessage(event.target.value)} value={message} />

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="lead-website">Website</label>
        <input autoComplete="off" id="lead-website" onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} type="text" value={website} />
      </div>

      {error && <p className="mt-4 text-sm text-fg" role="alert">{error}</p>}
      <Button className="mt-5" disabled={pending} type="submit">
        {pending ? 'Sending…' : 'Send Message'}
      </Button>
    </form>
  )
}
