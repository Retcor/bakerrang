'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, StatusMessage } from '@bakerrang/ui'
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
    return <StatusMessage>Loading businesses…</StatusMessage>
  }

  if (loadState === 'forbidden') {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-fg">Access unavailable</h2>
        <p className="mt-3 leading-7 text-fg-muted">
          Your account does not have access to platform administration.
        </p>
      </Card>
    )
  }

  if (loadState === 'error') {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-fg">Businesses could not be loaded</h2>
        <p className="mt-3 leading-7 text-fg-muted">
          Please try again. If the problem continues, check the API connection.
        </p>
        <div className="mt-5">
          <Button onClick={() => void loadBusinesses()}>Retry</Button>
        </div>
      </Card>
    )
  }

  return (
    <section aria-label="Businesses">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 xl:order-1"><BusinessList businesses={businesses} /></div>
        <div className="order-1 xl:order-2">
        <CreateBusinessForm
          onCreated={(business) => setBusinesses((current) => [business, ...current])}
          onForbidden={() => setLoadState('forbidden')}
        />
        </div>
      </div>
    </section>
  )
}
