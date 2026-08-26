'use client'

import { useState, type FormEvent } from 'react'
import { Button, Card, Field, Input } from '@bakerrang/ui'
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
    <Card className="p-5 xl:sticky xl:top-9">
      <form onSubmit={(event) => void handleSubmit(event)}>
      <h2 className="text-lg font-semibold text-fg">Create business</h2>
      <p className="mt-1 text-sm leading-6 text-fg-muted">Add a workspace for a new customer or brand.</p>
      <Field className="mt-5" error={error} help="Enter a name between 1 and 200 characters." id="business-name" label="Business name">
        <Input
          autoComplete="organization"
          className="mt-2"
          disabled={submitting}
          id="business-name"
          maxLength={201}
          onChange={(event) => setName(event.target.value)}
          placeholder="Business name"
          value={name}
        />
      </Field>
        <Button className="mt-4 w-full" disabled={submitting} type="submit">
          {submitting ? 'Creating…' : 'Create Business'}
        </Button>
      </form>
    </Card>
  )
}
