import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessNavigationGuardContext } from '../BusinessNavigationGuard'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({ getLeadNotificationSettings: vi.fn(), updateLeadNotificationSettings: vi.fn() }))
const navigation = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('../../../lib/leadNotifications', () => mocks)
vi.mock('../../../lib/businesses', () => ({ listBusinesses: vi.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Tenant', status: 'ACTIVE' }]) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: { children: ReactNode, href: string }) => <a href={href} {...props}>{children}</a> }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
vi.mock('../../_shell/AppShell', () => ({
  AppShell: ({ children, onNavigateRequest }: { children: ReactNode, onNavigateRequest: (href: string) => boolean }) => <><button onClick={() => onNavigateRequest('/businesses/tenant-1/website')} type="button">Leave workspace</button>{children}</>
}))

import { LeadNotificationSettings } from '../LeadNotificationSettings'
import { BusinessWorkspace } from '../BusinessWorkspace'

const renderSettings = (reportDirty = vi.fn()) => render(
  <BusinessNavigationGuardContext.Provider value={reportDirty}>
    <LeadNotificationSettings tenantId="tenant-1" />
  </BusinessNavigationGuardContext.Provider>
)

describe('Lead notification settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.push.mockReset()
    mocks.getLeadNotificationSettings.mockResolvedValue({ enabled: true, recipients: [] })
  })

  it('loads settings, explains the Business Profile fallback, and exposes no delivery controls', async () => {
    renderSettings()
    expect(await screen.findByText('These addresses receive new website-lead emails.')).toBeInTheDocument()
    expect(screen.getByText(/Business Profile email is used/)).toBeInTheDocument()
    expect(screen.getByLabelText('Enable lead email notifications')).toBeChecked()
    for (const label of ['Provider', 'Retry', 'Template', 'SMS', 'Test send']) expect(screen.queryByText(label)).not.toBeInTheDocument()
  })

  it('toggles, adds and removes recipients, then saves only the canonical settings and clears dirty state', async () => {
    const reportDirty = vi.fn()
    mocks.updateLeadNotificationSettings.mockResolvedValue({ enabled: true, recipients: ['authoritative@example.com'] })
    renderSettings(reportDirty)
    await screen.findByLabelText('Enable lead email notifications')
    fireEvent.click(screen.getByLabelText('Enable lead email notifications'))
    fireEvent.change(screen.getByLabelText('Recipient email'), { target: { value: '  Draft@Example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add recipient' }))
    expect(screen.getByText('draft@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft@example.com' }))
    expect(screen.queryByText('draft@example.com')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Recipient email'), { target: { value: 'draft@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add recipient' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateLeadNotificationSettings).toHaveBeenCalledWith('tenant-1', {
      enabled: false, recipients: ['draft@example.com']
    }))
    expect(await screen.findByText('authoritative@example.com')).toBeInTheDocument()
    expect(screen.queryByText('draft@example.com')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Enable lead email notifications')).toBeChecked()
    await waitFor(() => expect(reportDirty).toHaveBeenLastCalledWith(false))
  })

  it('keeps the draft and shows a validation error when Save fails', async () => {
    mocks.updateLeadNotificationSettings.mockRejectedValue(new ApiError(400, { error: 'Recipient email is invalid' }))
    renderSettings()
    await screen.findByLabelText('Recipient email')
    fireEvent.change(screen.getByLabelText('Recipient email'), { target: { value: 'bad@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add recipient' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Recipient email is invalid')
    expect(screen.getByText('bad@example.com')).toBeInTheDocument()
  })

  it('uses the shared dirty-navigation guard for Keep editing and Discard changes', async () => {
    render(<BusinessWorkspace description="Manage leads" tenantId="tenant-1" title="Leads"><LeadNotificationSettings tenantId="tenant-1" /></BusinessWorkspace>)
    await screen.findByLabelText('Enable lead email notifications')
    fireEvent.click(screen.getByLabelText('Enable lead email notifications'))
    fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }))
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(navigation.push).toHaveBeenCalledWith('/businesses/tenant-1/website')
  })
})
