'use client'

import { useState, type FormEvent } from 'react'
import { Button, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { createBusiness, type Business } from '../../lib/businesses'

export interface CreateBusinessFormProps {
  onCreated: (business: Business) => void
  onForbidden: () => void
}

export function CreateBusinessForm ({ onCreated, onForbidden }: CreateBusinessFormProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Business name is required.')
      return
    }
    if (trimmedName.length > 200) {
      setError('Business name must be 200 characters or fewer.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const business = await createBusiness(trimmedName)
      onCreated(business)
      setName('')
      setError(null)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        onForbidden()
        return
      }
      if (caught instanceof ApiError && caught.status === 400) {
        setError(caught.message)
      } else {
        setError('Unable to create the business. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="rounded-md border border-border bg-surface p-6" onSubmit={(event) => void handleSubmit(event)}>
      <label className="text-sm font-semibold text-fg" htmlFor="business-name">
        Business Name
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-describedby={error ? 'business-name-error' : 'business-name-help'}
          aria-invalid={Boolean(error)}
          autoComplete="organization"
          disabled={submitting}
          id="business-name"
          maxLength={201}
          onChange={(event) => setName(event.target.value)}
          placeholder="Business name"
          value={name}
        />
        <Button className="shrink-0" disabled={submitting} type="submit">
          {submitting ? 'Creating…' : 'Create Business'}
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-fg" id="business-name-error" role="alert">{error}</p>
      ) : (
        <p className="mt-3 text-sm text-fg-muted" id="business-name-help">
          Enter a name between 1 and 200 characters.
        </p>
      )}
    </form>
  )
}
