import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getAuditEvents: vi.fn(), listBusinesses: vi.fn(), push: vi.fn() }))

vi.mock('../../../lib/audit', () => ({ getAuditEvents: mocks.getAuditEvents }))
vi.mock('../../../lib/businesses', () => ({ listBusinesses: mocks.listBusinesses }))
vi.mock('../../providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: { children: ReactNode, href: string }) => <a href={href} {...props}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('../../_shell/AppShell', () => ({
  AppShell: ({ children, contextNav }: { children: ReactNode, contextNav?: Array<{ label: string }> }) => <><nav aria-label="Business workspace">{contextNav?.map((item) => <span key={item.label}>{item.label}</span>)}</nav>{children}</>
}))

import { BusinessActivity } from '../BusinessActivity'
import { BusinessWorkspace } from '../BusinessWorkspace'

const first = {
  eventId: 'event-1', occurredAt: 1735732800000, actorUserId: 'me', actorEmail: 'me@example.test', actorName: 'Me', actorType: 'USER' as const,
  action: 'page.create', entityType: 'page', summary: 'Created page', metadata: { pageTitle: 'About' }
}
const second = {
  eventId: 'event-2', occurredAt: 1735732700000, actorUserId: 'other', actorEmail: 'owner@example.test', actorName: 'Owner', actorType: 'USER' as const,
  action: 'lead.status.change', entityType: 'lead', summary: 'Changed lead status', metadata: { newStatus: 'CONTACTED' }
}
const third = {
  eventId: 'event-3', occurredAt: 1735732600000, actorUserId: 'email-only', actorEmail: 'email-only@example.test', actorName: null, actorType: 'USER' as const,
  action: 'media.delete', entityType: 'media', summary: 'Deleted media'
}

describe('Business Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listBusinesses.mockResolvedValue([])
  })

  it('registers Activity in the business workspace navigation', () => {
    render(<BusinessWorkspace description="History" tenantId="tenant-1" title="Activity"><div /></BusinessWorkspace>)
    expect(screen.getByRole('navigation', { name: 'Business workspace' })).toHaveTextContent('Activity')
  })

  it('loads event rows with actor fallbacks and useful context, without mutation controls', async () => {
    mocks.getAuditEvents.mockResolvedValue({ events: [first, second, third] })
    render(<BusinessActivity tenantId="tenant-1" />)
    expect(await screen.findByText('Created page')).toBeInTheDocument()
    expect(screen.getByText('You · Page: About')).toBeInTheDocument()
    expect(screen.getByText('Owner · Status: CONTACTED')).toBeInTheDocument()
    expect(screen.getByText('email-only@example.test')).toBeInTheDocument()
    for (const control of ['Edit', 'Delete', 'Rollback', 'Filter', 'Search', 'Export']) expect(screen.queryByRole('button', { name: control })).not.toBeInTheDocument()
    expect(mocks.getAuditEvents).toHaveBeenCalledWith('tenant-1')
  })

  it('shows empty and retryable initial-error states', async () => {
    mocks.getAuditEvents.mockResolvedValueOnce({ events: [] })
    const view = render(<BusinessActivity tenantId="tenant-1" />)
    expect(await screen.findByText('No activity yet')).toBeInTheDocument()
    view.unmount()
    mocks.getAuditEvents.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ events: [first] })
    render(<BusinessActivity tenantId="tenant-1" />)
    expect(await screen.findByText(/Activity could not be loaded/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Created page')).toBeInTheDocument()
  })

  it('forwards opaque cursors, appends unique rows, and preserves rows on load-more failure', async () => {
    mocks.getAuditEvents
      .mockResolvedValueOnce({ events: [first], nextCursor: 'opaque+/cursor==' })
      .mockResolvedValueOnce({ events: [first, second], nextCursor: 'next-cursor' })
      .mockRejectedValueOnce(new Error('offline'))
    render(<BusinessActivity tenantId="tenant-1" />)
    await screen.findByText('Created page')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('Changed lead status')
    expect(mocks.getAuditEvents).toHaveBeenLastCalledWith('tenant-1', 'opaque+/cursor==')
    expect(screen.getAllByText('Created page')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText(/More activity could not be loaded/)).toBeInTheDocument()
    expect(screen.getByText('Created page')).toBeInTheDocument()
    expect(screen.getByText('Changed lead status')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).not.toBeDisabled())
  })
})
