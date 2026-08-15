'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { listBusinesses, type Business } from '../../lib/businesses'
import { BusinessList } from './BusinessList'
import { CreateBusinessForm } from './CreateBusinessForm'

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error'

export function BusinessManager () {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const loadBusinesses = useCallback(async () => {
    setLoadState('loading')
    try {
      setBusinesses(await listBusinesses())
      setLoadState('ready')
    } catch (error) {
      setBusinesses([])
      setLoadState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void listBusinesses()
      .then((items) => {
        if (cancelled) return
        setBusinesses(items)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setBusinesses([])
        setLoadState(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'error')
      })
    return () => { cancelled = true }
  }, [])

  if (loadState === 'loading') {
    return <p className="mt-8 text-fg-muted" role="status">Loading businesses…</p>
  }

  if (loadState === 'forbidden') {
    return (
      <section className="mt-8 rounded-md border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold text-fg">Access unavailable</h2>
        <p className="mt-3 leading-7 text-fg-muted">
          Your account does not have access to platform administration.
        </p>
      </section>
    )
  }

  if (loadState === 'error') {
    return (
      <section className="mt-8 rounded-md border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold text-fg">Businesses could not be loaded</h2>
        <p className="mt-3 leading-7 text-fg-muted">
          Please try again. If the problem continues, check the API connection.
        </p>
        <div className="mt-5">
          <Button onClick={() => void loadBusinesses()}>Retry</Button>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-10" aria-labelledby="businesses-heading">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-fg" id="businesses-heading">
          Businesses
        </h2>
        <p className="mt-2 text-fg-muted">Create and review businesses managed by the platform.</p>
      </div>
      <div className="space-y-5">
        <CreateBusinessForm
          onCreated={(business) => setBusinesses((current) => [business, ...current])}
          onForbidden={() => setLoadState('forbidden')}
        />
        <BusinessList businesses={businesses} />
      </div>
    </section>
  )
}
