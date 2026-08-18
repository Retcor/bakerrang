'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import {
  activateSiteDomain,
  disableSiteDomain,
  getSiteDomain,
  registerSiteDomain,
  removeSiteDomain,
  verifySiteDomain,
  type SiteDomain
} from '../../lib/site'

type Operation = 'load' | 'add' | 'verify' | 'activate' | 'disable' | 'remove'

const statusLabel: Record<SiteDomain['status'], string> = {
  PENDING_VERIFICATION: 'Pending verification',
  VERIFIED: 'Verified',
  ACTIVE: 'Active',
  DISABLED: 'Disabled — verification required'
}

const friendlyError = (caught: unknown) => {
  if (caught instanceof ApiError && [400, 404, 409, 422].includes(caught.status)) {
    return caught.message
  }
  return 'Unable to update the custom domain. Please try again.'
}

export function CustomDomainEditor ({ onCancel, tenantId }: {
  onCancel: () => void
  tenantId: string
}) {
  const [domain, setDomain] = useState<SiteDomain | null>(null)
  const [hostname, setHostname] = useState('')
  const [pending, setPending] = useState<Operation | null>('load')
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getSiteDomain(tenantId).then((value) => {
      if (!cancelled) setDomain(value)
    }).catch((caught) => {
      if (!cancelled) setError(friendlyError(caught))
    }).finally(() => {
      if (!cancelled) setPending(null)
    })
    return () => { cancelled = true }
  }, [tenantId])

  const run = async (
    operation: Exclude<Operation, 'load' | 'add' | 'remove'>,
    action: () => Promise<SiteDomain>,
    success: string
  ) => {
    if (pending) return
    setPending(operation)
    setError(null)
    setFeedback(null)
    try {
      setDomain(await action())
      setFeedback(success)
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setPending(null)
    }
  }

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || !hostname) return
    setPending('add')
    setError(null)
    setFeedback(null)
    try {
      setDomain(await registerSiteDomain(tenantId, hostname))
      setFeedback('Domain added. Create the TXT record below, then verify ownership.')
      setHostname('')
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setPending(null)
    }
  }

  const remove = async () => {
    if (pending || !window.confirm('Remove this custom domain? Routing will stop immediately.')) return
    setPending('remove')
    setError(null)
    setFeedback(null)
    try {
      await removeSiteDomain(tenantId)
      setDomain(null)
      setFeedback('Custom domain removed. Published website content was not changed.')
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setPending(null)
    }
  }

  const ipv4 = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_IPV4_ADDRESS
  const cname = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET

  return (
    <section className="w-full max-w-3xl rounded-md border border-border bg-surface p-4 text-left" aria-labelledby={`custom-domain-${tenantId}`}>
      <h3 className="text-lg font-semibold text-fg" id={`custom-domain-${tenantId}`}>Custom Domain</h3>
      <p className="mt-2 text-sm text-fg-muted">One customer-owned hostname can serve this website after ownership, HTTPS, and routing are ready.</p>

      {pending === 'load' ? (
        <p className="mt-5 text-sm text-fg-muted" role="status">Loading domain…</p>
      ) : !domain ? (
        <form className="mt-5" onSubmit={(event) => void add(event)}>
          <label className="text-sm font-semibold text-fg" htmlFor={`domain-hostname-${tenantId}`}>Hostname</label>
          <Input
            autoComplete="off"
            className="mt-2"
            disabled={Boolean(pending)}
            id={`domain-hostname-${tenantId}`}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="example.com"
            value={hostname}
          />
          <p className="mt-2 text-xs text-fg-muted">Enter a hostname only—no protocol, path, port, wildcard, or IP address.</p>
          <Button className="mt-4 min-h-9 px-3 py-1.5 text-xs" disabled={Boolean(pending) || !hostname} type="submit">
            {pending === 'add' ? 'Adding…' : 'Add Domain'}
          </Button>
        </form>
      ) : (
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-fg">{domain.hostname}</p>
            <span className="mt-2 inline-flex rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-fg-muted">{statusLabel[domain.status]}</span>
          </div>

          {['PENDING_VERIFICATION', 'DISABLED'].includes(domain.status) && (
            <div className="rounded-md border border-border bg-bg p-4">
              <h4 className="text-sm font-semibold text-fg">DNS ownership verification</h4>
              <p className="mt-2 text-sm text-fg-muted">Create this TXT record. DNS changes may take time to propagate.</p>
              <dl className="mt-3 grid gap-3 text-sm">
                <div><dt className="font-semibold text-fg">Name</dt><dd className="break-all font-mono text-fg-muted">_bakerrang-verification.{domain.hostname}</dd></div>
                <div><dt className="font-semibold text-fg">Value</dt><dd className="break-all font-mono text-fg-muted">{domain.verificationToken}</dd></div>
              </dl>
              <Button className="mt-4 min-h-9 px-3 py-1.5 text-xs" disabled={Boolean(pending)} onClick={() => void run('verify', () => verifySiteDomain(tenantId), 'Domain ownership verified.')} type="button">
                {pending === 'verify' ? 'Verifying…' : 'Verify TXT'}
              </Button>
            </div>
          )}

          {domain.status === 'VERIFIED' && (
            <div className="rounded-md border border-border bg-bg p-4">
              <h4 className="text-sm font-semibold text-fg">HTTPS and routing</h4>
              <p className="mt-2 text-sm text-fg-muted">Have the BakerRang operator add certificate coverage, then point DNS at the shared load balancer and confirm HTTPS works before activation.</p>
              {ipv4 && <p className="mt-2 text-sm text-fg"><span className="font-semibold">A record:</span> <span className="font-mono">{ipv4}</span></p>}
              {cname && <p className="mt-2 text-sm text-fg"><span className="font-semibold">Optional subdomain CNAME:</span> <span className="font-mono">{cname}</span></p>}
              <Button className="mt-4 min-h-9 px-3 py-1.5 text-xs" disabled={Boolean(pending)} onClick={() => void run('activate', () => activateSiteDomain(tenantId), 'Custom domain is active.')} type="button">
                {pending === 'activate' ? 'Activating…' : 'Activate'}
              </Button>
            </div>
          )}

          {domain.status === 'ACTIVE' && (
            <div className="rounded-md border border-border bg-bg p-4">
              <a className="font-semibold text-accent underline" href={`https://${domain.hostname}/`} rel="noopener noreferrer" target="_blank">https://{domain.hostname}/</a>
              <p className="mt-2 text-sm text-fg-muted">The normal shared public URL now permanently redirects here. Preview remains on the shared route.</p>
              <Button className="mt-4 min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={Boolean(pending)} onClick={() => void run('disable', () => disableSiteDomain(tenantId), 'Domain disabled. Fresh TXT verification is required before activation.')} type="button">
                {pending === 'disable' ? 'Disabling…' : 'Disable'}
              </Button>
            </div>
          )}

          <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={Boolean(pending)} onClick={() => void remove()} type="button">
            {pending === 'remove' ? 'Removing…' : 'Remove Domain'}
          </Button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-fg" role="alert">{error}</p>}
      {feedback && <p className="mt-4 text-sm text-fg-muted" role="status">{feedback}</p>}
      <div className="mt-5 flex justify-end">
        <Button className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg" disabled={Boolean(pending)} onClick={onCancel} type="button">Close</Button>
      </div>
    </section>
  )
}
