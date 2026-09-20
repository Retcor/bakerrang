'use client'

import { useState, type FormEvent } from 'react'
import { submitLeadForContext } from './leadPreview'
import type { RenderContext } from './renderContext'

export interface LeadInput {
  name: string
  email?: string
  phone?: string
  message: string
  website?: string
}

export interface LeadFormProps {
  context: Pick<RenderContext, 'mode'>
  onSubmit: (input: LeadInput) => Promise<void>
}

const emailPattern = /^\S+@\S+\.\S+$/
const phoneDial = (value: string) => value.replace(/[()\-.\s]/g, '')

export function LeadForm ({ context, onSubmit }: LeadFormProps) {
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
    if (context.mode !== 'PUBLIC') {
      setError(await submitLeadForContext(context.mode, async () => {}))
      return
    }

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
      await submitLeadForContext(context.mode, () => onSubmit({
        name: trimmedName,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
        message: trimmedMessage,
        website
      }))
      setSubmitted(true)
    } catch (caught) {
      setError(caught instanceof Error && caught.message
        ? caught.message
        : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return <div className="site-radius-panel border border-border bg-surface p-6" role="status"><h2 className="text-xl font-semibold text-fg">Thanks for reaching out.</h2><p className="mt-2 text-fg-muted">Your message has been sent.</p></div>
  }

  return (
    <form className="site-radius-panel border border-border bg-surface p-5 sm:p-6" data-br-role="form" onSubmit={(event) => void handleSubmit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor="lead-name">Name</label>
      <input autoComplete="name" className="site-radius-control mt-2 min-h-11 w-full border border-border bg-surface px-3 py-2 text-fg shadow-xs outline-none transition-colors placeholder:text-fg-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60" data-br-role="input" disabled={pending} id="lead-name" maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor="lead-email">Email</label>
      <input autoComplete="email" className="site-radius-control mt-2 min-h-11 w-full border border-border bg-surface px-3 py-2 text-fg shadow-xs outline-none transition-colors placeholder:text-fg-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60" data-br-role="input" disabled={pending} id="lead-email" maxLength={254} onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor="lead-phone">Phone</label>
      <input autoComplete="tel" className="site-radius-control mt-2 min-h-11 w-full border border-border bg-surface px-3 py-2 text-fg shadow-xs outline-none transition-colors placeholder:text-fg-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60" data-br-role="input" disabled={pending} id="lead-phone" maxLength={50} onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} />
      <label className="mt-5 block text-sm font-semibold text-fg" htmlFor="lead-message">Message</label>
      <textarea autoComplete="off" className="site-radius-control mt-2 min-h-36 w-full resize-y border border-border bg-surface px-3 py-2 text-fg outline-none placeholder:text-fg-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50" data-br-role="input" disabled={pending} id="lead-message" maxLength={2000} onChange={(event) => setMessage(event.target.value)} value={message} />
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label htmlFor="lead-website">Website</label><input autoComplete="off" id="lead-website" onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} type="text" value={website} /></div>
      {error && <p className="mt-4 text-sm text-fg" role="alert">{error}</p>}
      <button className="site-radius-control mt-5 inline-flex min-h-11 items-center justify-center gap-2 border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-xs transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50" data-br-role="button" disabled={pending} type="submit">{pending ? 'Sending…' : 'Send Message'}</button>
    </form>
  )
}
