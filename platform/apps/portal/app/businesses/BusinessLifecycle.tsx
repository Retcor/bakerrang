'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Field, Input, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { listBusinesses } from '../../lib/businesses'
import {
  deleteTenant,
  downloadTenantExport,
  getTenantDeletionStatus,
  resumeTenantDeletion,
  type TenantDeletion,
  type TenantDeletionStatus
} from '../../lib/tenantLifecycle'

type LoadState = 'loading' | 'ready'
type Operation = 'export' | 'delete' | 'resume' | null

const noDeletionJob = (error: unknown) => error instanceof ApiError && error.status === 404

const usefulError = (error: unknown, fallback: string) => {
  if (error instanceof ApiError && [400, 403, 404, 409].includes(error.status)) return error.message
  return fallback
}

const isInProgress = (status?: TenantDeletionStatus) => status === 'PENDING_DELETE' || status === 'DELETING'

export function BusinessLifecycle ({ tenantId }: { tenantId: string }) {
  const { refresh, replace } = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [deletion, setDeletion] = useState<TenantDeletion | null>(null)
  const [deletionStatusKnown, setDeletionStatusKnown] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [operation, setOperation] = useState<Operation>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    setDeletionStatusKnown(false)
    setError(null)
    setNotice(null)
    const [deletionResult, businessesResult] = await Promise.allSettled([
      getTenantDeletionStatus(tenantId),
      listBusinesses()
    ])

    if (deletionResult.status === 'fulfilled' && deletionResult.value.status === 'COMPLETE') {
      setDeletion(deletionResult.value)
      setDeletionStatusKnown(true)
      setLoadState('ready')
      setNotice('This business has already been deleted. Returning to all businesses…')
      replace('/')
      refresh()
      return
    }

    if (deletionResult.status === 'fulfilled') {
      setDeletion(deletionResult.value)
      setDeletionStatusKnown(true)
    } else if (noDeletionJob(deletionResult.reason)) {
      setDeletion(null)
      setDeletionStatusKnown(true)
    }
    else setError('Deletion status could not be loaded. Refresh status to try again.')

    if (businessesResult.status === 'fulfilled') {
      setBusinessName(businessesResult.value.find((business) => business.id === tenantId)?.name ?? null)
    } else {
      setError((current) => current || 'Business details could not be loaded. Retry before deleting this business.')
    }
    setLoadState('ready')
  }, [refresh, replace, tenantId])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const refreshDeletion = async () => {
    if (operation) return
    setOperation('resume')
    setError(null)
    try {
      const current = await getTenantDeletionStatus(tenantId)
      if (current.status === 'COMPLETE') {
        setDeletion(current)
        setDeletionStatusKnown(true)
        setNotice('This business has already been deleted. Returning to all businesses…')
        replace('/')
        refresh()
        return
      }
      setDeletion(current)
      setDeletionStatusKnown(true)
      setNotice('Deletion status refreshed.')
    } catch (caught) {
      if (noDeletionJob(caught)) {
        setDeletion(null)
        setDeletionStatusKnown(true)
        setNotice('No deletion is currently in progress.')
      } else setError(usefulError(caught, 'Deletion status could not be refreshed.'))
    } finally {
      setOperation(null)
    }
  }

  const exportData = async () => {
    if (operation) return
    setOperation('export')
    setError(null)
    setNotice(null)
    try {
      const { blob, filename } = await downloadTenantExport(tenantId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      try {
        anchor.href = url
        anchor.download = filename
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
      } finally {
        anchor.remove()
        URL.revokeObjectURL(url)
      }
      setNotice('Your tenant data download has started.')
    } catch (caught) {
      setError(usefulError(caught, 'Tenant data could not be exported. Please try again.'))
    } finally {
      setOperation(null)
    }
  }

  const finishDeletion = (result: TenantDeletion) => {
    setDeletion(result)
    if (result.status === 'COMPLETE') {
      setNotice('Business deleted. Returning to all businesses…')
      replace('/')
      refresh()
    } else if (result.status === 'FAILED') {
      setNotice(null)
      setError('Deletion did not complete. You can resume deletion without confirming the business name again.')
    }
  }

  const submitDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (operation || !businessName || confirmation !== businessName) return
    setOperation('delete')
    setError(null)
    setNotice(null)
    try {
      finishDeletion(await deleteTenant(tenantId, confirmation))
    } catch (caught) {
      if (caught instanceof ApiError && typeof caught.body === 'object' && caught.body !== null && 'status' in caught.body && caught.body.status === 'FAILED') {
        finishDeletion({ tenantId, status: 'FAILED' })
      } else {
        setError(usefulError(caught, 'Deletion could not be started. Please try again.'))
      }
    } finally {
      setOperation(null)
    }
  }

  const resume = async () => {
    if (operation) return
    setOperation('resume')
    setError(null)
    setNotice(null)
    try {
      finishDeletion(await resumeTenantDeletion(tenantId))
    } catch (caught) {
      if (caught instanceof ApiError && typeof caught.body === 'object' && caught.body !== null && 'status' in caught.body && caught.body.status === 'FAILED') {
        finishDeletion({ tenantId, status: 'FAILED' })
      } else {
        setError(usefulError(caught, 'Deletion could not be resumed. Please try again.'))
      }
    } finally {
      setOperation(null)
    }
  }

  if (loadState === 'loading') return <Card className="p-5" role="status">Loading data and lifecycle settings…</Card>

  const lifecycleStatus = deletion?.status
  const deleting = isInProgress(lifecycleStatus)
  const failed = lifecycleStatus === 'FAILED'
  const normal = deletionStatusKnown && !lifecycleStatus
  const canDelete = normal && Boolean(businessName) && confirmation === businessName && !operation

  return <section aria-label="Data and lifecycle" className="space-y-6">
    {notice && <StatusMessage tone="success">{notice}</StatusMessage>}
    {error && <StatusMessage tone="error">{error}</StatusMessage>}

    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-fg">Export data</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">Download a copy of this business’s site data, leads and notes, audit history, and media files.</p>
      <Button className="mt-5" disabled={Boolean(operation)} onClick={() => void exportData()} type="button" variant="secondary">
        {operation === 'export' ? 'Preparing download…' : 'Download tenant data'}
      </Button>
    </Card>

    <Card className="border-danger p-5 sm:p-6" aria-labelledby={`delete-business-${tenantId}`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-danger-fg">Danger zone</p>
      <h2 className="mt-1 text-lg font-semibold text-fg" id={`delete-business-${tenantId}`}>Delete business</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-fg-muted">Deletion permanently removes the website and its configuration, published history and revisions, leads and notes, uploaded media, audit history, domain association, and tenant membership and configuration. This cannot be undone.</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">Export data first. Customer DNS records at their registrar are not removed automatically.</p>
      <Button className="mt-4" disabled={Boolean(operation)} onClick={() => void exportData()} size="sm" type="button" variant="secondary">Export first</Button>

      {deleting && <div className="mt-5 rounded-lg border border-warning bg-surface-muted p-4">
        <h3 className="font-semibold text-fg">Deletion is in progress</h3>
        <p className="mt-1 text-sm leading-6 text-fg-muted">Normal deletion controls are disabled while the existing deletion is completed.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={Boolean(operation)} onClick={() => void refreshDeletion()} type="button" variant="secondary">{operation === 'resume' ? 'Refreshing…' : 'Refresh status'}</Button>
          <Button disabled={Boolean(operation)} onClick={() => void resume()} type="button" variant="danger">{operation === 'resume' ? 'Resuming…' : 'Resume deletion'}</Button>
        </div>
      </div>}

      {failed && <div className="mt-5 rounded-lg border border-danger bg-danger-subtle p-4">
        <h3 className="font-semibold text-danger-fg">Deletion did not complete</h3>
        <p className="mt-1 text-sm leading-6 text-danger-fg">Resume the authorized deletion. You do not need to confirm the business name again.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={Boolean(operation)} onClick={() => void refreshDeletion()} type="button" variant="secondary">{operation === 'resume' ? 'Refreshing…' : 'Refresh status'}</Button>
          <Button disabled={Boolean(operation)} onClick={() => void resume()} type="button" variant="danger">{operation === 'resume' ? 'Resuming…' : 'Resume deletion'}</Button>
        </div>
      </div>}

      {!deletionStatusKnown && <div className="mt-5 rounded-lg border border-warning bg-surface-muted p-4">
        <h3 className="font-semibold text-fg">Deletion status unavailable</h3>
        <p className="mt-1 text-sm leading-6 text-fg-muted">Refresh the deletion status before starting a new deletion.</p>
        <Button className="mt-4" disabled={Boolean(operation)} onClick={() => void refreshDeletion()} type="button" variant="secondary">{operation === 'resume' ? 'Refreshing…' : 'Refresh status'}</Button>
      </div>}

      {normal && <form className="mt-5 max-w-xl" onSubmit={(event) => void submitDelete(event)}>
        <Field help={businessName ? <>Type <strong>{businessName}</strong> exactly to enable deletion.</> : 'Business name is unavailable. Retry loading this page before deleting.'} id={`delete-confirmation-${tenantId}`} label="Confirm business name">
          <Input autoComplete="off" disabled={Boolean(operation) || !businessName} onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
        </Field>
        <Button className="mt-4" disabled={!canDelete} type="submit" variant="danger">{operation === 'delete' ? 'Deleting…' : 'Delete business permanently'}</Button>
      </form>}
    </Card>
  </section>
}
