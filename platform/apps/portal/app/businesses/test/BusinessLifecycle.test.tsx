import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api'

const mocks = vi.hoisted(() => ({
  listBusinesses: vi.fn(), downloadTenantExport: vi.fn(), getTenantDeletionStatus: vi.fn(), deleteTenant: vi.fn(), resumeTenantDeletion: vi.fn(),
  replace: vi.fn(), refresh: vi.fn()
}))

vi.mock('../../../lib/businesses', () => ({ listBusinesses: mocks.listBusinesses }))
vi.mock('../../../lib/tenantLifecycle', () => ({
  downloadTenantExport: mocks.downloadTenantExport,
  getTenantDeletionStatus: mocks.getTenantDeletionStatus,
  deleteTenant: mocks.deleteTenant,
  resumeTenantDeletion: mocks.resumeTenantDeletion
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: { children: ReactNode, href: string }) => <a href={href} {...props}>{children}</a> }))
vi.mock('../../_shell/AppShell', () => ({
  AppShell: ({ children, contextNav }: { children: ReactNode, contextNav?: Array<{ label: string }> }) => <><nav aria-label="Business workspace">{contextNav?.map((item) => <span key={item.label}>{item.label}</span>)}</nav>{children}</>
}))

import { BusinessLifecycle } from '../BusinessLifecycle'
import { BusinessOverview, BusinessWorkspace } from '../BusinessWorkspace'
import SettingsPage from '../[tenantId]/settings/page'

const business = { id: 'tenant-1', name: 'Northwind Bakery', status: 'ACTIVE', createdAt: 1, updatedAt: 1, createdByUserId: 'admin' }

describe('Business lifecycle settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listBusinesses.mockResolvedValue([business])
    mocks.getTenantDeletionStatus.mockRejectedValue(new ApiError(404, { error: 'Tenant deletion was not authorized' }))
    mocks.downloadTenantExport.mockResolvedValue({ blob: new Blob(['zip']), filename: 'northwind.zip' })
    mocks.deleteTenant.mockResolvedValue({ tenantId: 'tenant-1', status: 'COMPLETE' })
    mocks.resumeTenantDeletion.mockResolvedValue({ tenantId: 'tenant-1', status: 'COMPLETE' })
  })

  it('adds Settings once in workspace navigation and an Overview link', () => {
    render(<BusinessWorkspace description="Settings" tenantId="tenant-1" title="Settings"><div /></BusinessWorkspace>)
    const nav = screen.getByRole('navigation', { name: 'Business workspace' })
    expect(within(nav).getAllByText('Settings')).toHaveLength(1)

    const overview = render(<BusinessOverview tenantId="tenant-1" />)
    expect(screen.getByRole('link', { name: /Manage data & lifecycle/ })).toHaveAttribute('href', '/businesses/tenant-1/settings')
    overview.unmount()
  })

  it('resolves the Settings route within the business workspace', async () => {
    render(await SettingsPage({ params: Promise.resolve({ tenantId: 'tenant-1' }) }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Download tenant data' })).toBeInTheDocument()
  })

  it('downloads an authenticated binary export once, preserves the filename, and revokes the object URL', async () => {
    const objectUrl = vi.fn(() => 'blob:tenant-export')
    const revoke = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: objectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
    render(<BusinessLifecycle tenantId="tenant-1" />)
    const exportButton = await screen.findByRole('button', { name: 'Download tenant data' })
    fireEvent.click(exportButton)
    fireEvent.click(exportButton)
    await waitFor(() => expect(mocks.downloadTenantExport).toHaveBeenCalledTimes(1))
    expect(objectUrl).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('northwind.zip')
    expect(revoke).toHaveBeenCalledWith('blob:tenant-export')
    expect(await screen.findByText('Your tenant data download has started.')).toBeInTheDocument()
  })

  it('shows an export error without disabling the separate deletion challenge', async () => {
    mocks.downloadTenantExport.mockRejectedValueOnce(new Error('offline'))
    render(<BusinessLifecycle tenantId="tenant-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Download tenant data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tenant data could not be exported')
    expect(screen.getByRole('button', { name: 'Delete business permanently' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Confirm business name'), { target: { value: 'Northwind Bakery' } })
    expect(screen.getByRole('button', { name: 'Delete business permanently' })).toBeEnabled()
  })

  it('requires the exact name, sends only its confirmation, and navigates on COMPLETE', async () => {
    let completeDeletion: ((value: { tenantId: string, status: 'COMPLETE' }) => void) | undefined
    mocks.deleteTenant.mockImplementationOnce(() => new Promise<{ tenantId: string, status: 'COMPLETE' }>((resolve) => { completeDeletion = resolve }))
    render(<BusinessLifecycle tenantId="tenant-1" />)
    const input = await screen.findByLabelText('Confirm business name')
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()
    expect(screen.getByText(/DNS records at their registrar are not removed automatically/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'northwind bakery' } })
    expect(screen.getByRole('button', { name: 'Delete business permanently' })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Northwind' } })
    expect(screen.getByRole('button', { name: 'Delete business permanently' })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Northwind Bakery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete business permanently' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deleting…' }))
    expect(mocks.deleteTenant).toHaveBeenCalledTimes(1)
    completeDeletion?.({ tenantId: 'tenant-1', status: 'COMPLETE' })
    await waitFor(() => expect(mocks.deleteTenant).toHaveBeenCalledWith('tenant-1', 'Northwind Bakery'))
    expect(mocks.replace).toHaveBeenCalledWith('/')
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('shows a failed deletion as resumable without asking for confirmation again', async () => {
    mocks.deleteTenant.mockRejectedValueOnce(new ApiError(500, { status: 'FAILED' }))
    render(<BusinessLifecycle tenantId="tenant-1" />)
    fireEvent.change(await screen.findByLabelText('Confirm business name'), { target: { value: 'Northwind Bakery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete business permanently' }))
    expect(await screen.findByText('Deletion did not complete')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm business name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume deletion' }))
    await waitFor(() => expect(mocks.resumeTenantDeletion).toHaveBeenCalledWith('tenant-1'))
  })

  it.each(['PENDING_DELETE', 'DELETING'] as const)('shows %s as an in-progress lifecycle state', async (status) => {
    mocks.getTenantDeletionStatus.mockResolvedValueOnce({ tenantId: 'tenant-1', status })
    render(<BusinessLifecycle tenantId="tenant-1" />)
    expect(await screen.findByText('Deletion is in progress')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume deletion' })).toBeEnabled()
    expect(screen.queryByLabelText('Confirm business name')).not.toBeInTheDocument()
  })

  it('shows an existing FAILED job and redirects away from a COMPLETE job', async () => {
    mocks.getTenantDeletionStatus.mockResolvedValueOnce({ tenantId: 'tenant-1', status: 'FAILED' })
    const failed = render(<BusinessLifecycle tenantId="tenant-1" />)
    expect(await screen.findByText('Deletion did not complete')).toBeInTheDocument()
    failed.unmount()

    mocks.getTenantDeletionStatus.mockResolvedValueOnce({ tenantId: 'tenant-1', status: 'COMPLETE' })
    render(<BusinessLifecycle tenantId="tenant-1" />)
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/'))
    expect(screen.getByText(/already been deleted/)).toBeInTheDocument()
  })
})
