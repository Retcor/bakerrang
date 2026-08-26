'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, ConfirmDialog, Field, Input, StatusMessage } from '@bakerrang/ui'
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
  onCancel?: () => void
  tenantId: string
}) {
  const [domain, setDomain] = useState<SiteDomain | null>(null)
  const [hostname, setHostname] = useState('')
  const [pending, setPending] = useState<Operation | null>('load')
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

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
    if (pending) return
    setPending('remove')
    setError(null)
    setFeedback(null)
    try {
      await removeSiteDomain(tenantId)
      setDomain(null)
      setConfirmingRemove(false)
      setFeedback('Custom domain removed. Published website content was not changed.')
    } catch (caught) {
      setError(friendlyError(caught))
    } finally {
      setPending(null)
    }
  }

  const ipv4 = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_IPV4_ADDRESS
  const cname = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET
  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback(`${label} copied.`)
    } catch {
      setError(`Unable to copy ${label.toLowerCase()}.`)
    }
  }

  return (
    <Card className="w-full p-5 text-left sm:p-6" aria-labelledby={`custom-domain-${tenantId}`}>
      <h3 className="text-lg font-semibold text-fg" id={`custom-domain-${tenantId}`}>Custom Domain</h3>
      <p className="mt-2 text-sm text-fg-muted">One customer-owned hostname can serve this website after ownership, HTTPS, and routing are ready.</p>

      {pending === 'load' ? (
        <p className="mt-5 text-sm text-fg-muted" role="status">Loading domain…</p>
      ) : !domain ? (
        <form className="mt-5" onSubmit={(event) => void add(event)}>
          <Field help="Enter a hostname only—no protocol, path, port, wildcard, or IP address." id={`domain-hostname-${tenantId}`} label="Hostname">
          <Input
            autoComplete="off"
            className="mt-2"
            disabled={Boolean(pending)}
            id={`domain-hostname-${tenantId}`}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="example.com"
            value={hostname}
          />
          </Field>
          <Button className="mt-4" disabled={Boolean(pending) || !hostname} type="submit">
            {pending === 'add' ? 'Adding…' : 'Add Domain'}
          </Button>
        </form>
      ) : (
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-fg">{domain.hostname}</p>
            <Badge className="mt-2" tone={domain.status === 'ACTIVE' ? 'success' : domain.status === 'VERIFIED' ? 'info' : 'warning'}>{statusLabel[domain.status]}</Badge>
          </div>

          {['PENDING_VERIFICATION', 'DISABLED'].includes(domain.status) && (
            <div className="rounded-lg border border-border bg-surface-muted p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-fg">DNS ownership verification</h4>
              <p className="mt-2 text-sm text-fg-muted">Create this TXT record. DNS changes may take time to propagate.</p>
              <dl className="mt-3 grid gap-3 text-sm">
                <div><dt className="font-semibold text-fg">Name</dt><dd className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><code className="min-w-0 overflow-x-auto whitespace-nowrap rounded-md bg-surface px-2 py-1 font-mono text-fg-muted">_bakerrang-verification.{domain.hostname}</code><Button onClick={() => void copyValue(`_bakerrang-verification.${domain.hostname}`, 'Record name')} size="sm" type="button" variant="secondary">Copy</Button></dd></div>
                <div><dt className="font-semibold text-fg">Value</dt><dd className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><code className="min-w-0 overflow-x-auto whitespace-nowrap rounded-md bg-surface px-2 py-1 font-mono text-fg-muted">{domain.verificationToken}</code><Button onClick={() => void copyValue(domain.verificationToken, 'TXT value')} size="sm" type="button" variant="secondary">Copy</Button></dd></div>
              </dl>
              <Button className="mt-4" disabled={Boolean(pending)} onClick={() => void run('verify', () => verifySiteDomain(tenantId), 'Domain ownership verified.')} type="button">
                {pending === 'verify' ? 'Verifying…' : 'Verify TXT'}
              </Button>
            </div>
          )}

          {domain.status === 'VERIFIED' && (
            <div className="rounded-lg border border-border bg-surface-muted p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-fg">HTTPS and routing</h4>
              <p className="mt-2 text-sm text-fg-muted">Before activating this domain, configure HTTPS certificate coverage and point the domain to the hosting address below. Confirm the site is reachable over HTTPS, then activate the domain.</p>
              {ipv4 && <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-sm font-semibold text-fg">A record</span><code className="min-w-0 overflow-x-auto whitespace-nowrap rounded-md bg-surface px-2 py-1 font-mono text-sm">{ipv4}</code><Button onClick={() => void copyValue(ipv4, 'A record')} size="sm" variant="secondary">Copy</Button></div>}
              {cname && <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-sm font-semibold text-fg">Optional subdomain CNAME</span><code className="min-w-0 overflow-x-auto whitespace-nowrap rounded-md bg-surface px-2 py-1 font-mono text-sm">{cname}</code><Button onClick={() => void copyValue(cname, 'CNAME target')} size="sm" variant="secondary">Copy</Button></div>}
              <Button className="mt-4" disabled={Boolean(pending)} onClick={() => void run('activate', () => activateSiteDomain(tenantId), 'Custom domain is active.')} type="button">
                {pending === 'activate' ? 'Activating…' : 'Activate'}
              </Button>
            </div>
          )}

          {domain.status === 'ACTIVE' && (
            <div className="rounded-lg border border-border bg-surface-muted p-4 sm:p-5">
              <a className="break-all font-semibold text-info-fg underline" href={`https://${domain.hostname}/`} rel="noopener noreferrer" target="_blank">https://{domain.hostname}/</a>
              <p className="mt-2 text-sm text-fg-muted">The normal shared public URL now permanently redirects here. Preview remains on the shared route.</p>
              <Button className="mt-4" disabled={Boolean(pending)} onClick={() => void run('disable', () => disableSiteDomain(tenantId), 'Domain disabled. Fresh TXT verification is required before activation.')} type="button" variant="secondary">
                {pending === 'disable' ? 'Disabling…' : 'Disable'}
              </Button>
            </div>
          )}

          <Button disabled={Boolean(pending)} onClick={() => setConfirmingRemove(true)} type="button" variant="danger">
            {pending === 'remove' ? 'Removing…' : 'Remove Domain'}
          </Button>
        </div>
      )}

      {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
      {feedback && <div className="mt-4"><StatusMessage tone="success">{feedback}</StatusMessage></div>}
      {onCancel && <div className="mt-5 flex justify-end"><Button disabled={Boolean(pending)} onClick={onCancel} type="button" variant="secondary">Close</Button></div>}
      <ConfirmDialog busy={pending === 'remove'} confirmLabel="Remove domain" description="Routing will stop immediately. Published website content will not be changed." onCancel={() => setConfirmingRemove(false)} onConfirm={() => void remove()} open={confirmingRemove} title="Remove this custom domain?" />
    </Card>
  )
}
