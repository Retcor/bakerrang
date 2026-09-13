import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiDownload: vi.fn(), apiGet: vi.fn(), apiSend: vi.fn() }))

vi.mock('../api', () => mocks)

import { deleteTenant, downloadTenantExport, getTenantDeletionStatus, resumeTenantDeletion } from '../tenantLifecycle'

describe('tenant lifecycle API helpers', () => {
  it('uses authenticated binary download data and a safe server filename', async () => {
    const blob = new Blob(['zip'])
    mocks.apiDownload.mockResolvedValue({ blob, contentDisposition: 'attachment; filename="northwind-export.zip"' })
    await expect(downloadTenantExport('tenant/one')).resolves.toMatchObject({ blob, filename: 'northwind-export.zip' })
    expect(mocks.apiDownload).toHaveBeenCalledWith('/tenants/tenant%2Fone/export')
  })

  it('falls back when a content-disposition filename is unsafe', async () => {
    mocks.apiDownload.mockResolvedValue({ blob: new Blob(), contentDisposition: 'attachment; filename="../../unsafe.zip"' })
    await expect(downloadTenantExport('tenant/one')).resolves.toMatchObject({ filename: 'tenant-tenant_one.zip' })
  })

  it('uses focused status, delete, and resume endpoints without tenant resource paths', async () => {
    mocks.apiGet.mockResolvedValue({ tenantId: 'tenant/one', status: 'FAILED' })
    mocks.apiSend.mockResolvedValue({ tenantId: 'tenant/one', status: 'COMPLETE' })
    await getTenantDeletionStatus('tenant/one')
    await deleteTenant('tenant/one', 'Northwind')
    await resumeTenantDeletion('tenant/one')
    expect(mocks.apiGet).toHaveBeenCalledWith('/tenants/tenant%2Fone/deletion')
    expect(mocks.apiSend).toHaveBeenNthCalledWith(1, 'POST', '/tenants/tenant%2Fone/delete', { confirmation: 'Northwind' })
    expect(mocks.apiSend).toHaveBeenNthCalledWith(2, 'POST', '/tenants/tenant%2Fone/delete/resume')
  })
})
