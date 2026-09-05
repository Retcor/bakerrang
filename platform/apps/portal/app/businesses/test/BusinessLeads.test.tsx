import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLeads: vi.fn(),
  getLead: vi.fn(),
  updateLeadStatus: vi.fn(),
  deleteLead: vi.fn(),
  getLeadNotes: vi.fn(),
  addLeadNote: vi.fn()
}))

vi.mock('../../../lib/leads', () => ({
  getLeads: mocks.getLeads,
  getLead: mocks.getLead,
  updateLeadStatus: mocks.updateLeadStatus,
  deleteLead: mocks.deleteLead,
  getLeadNotes: mocks.getLeadNotes,
  addLeadNote: mocks.addLeadNote,
  LEAD_STATUSES: ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']
}))

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'platform' }, status: 'authenticated' })
}))

import { BusinessLeads } from '../BusinessLeads'

const leadA = {
  id: 'lead-1',
  name: 'Jamie Visitor',
  email: 'jamie@example.com',
  status: 'NEW' as const,
  source: 'WEBSITE',
  createdAt: 10,
  updatedAt: 10
}
const leadB = {
  id: 'lead-2',
  name: 'Other Visitor',
  status: 'CONTACTED' as const,
  source: 'WEBSITE',
  createdAt: 20,
  updatedAt: 21
}

describe('Business leads inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLeads.mockResolvedValue({ leads: [leadA, leadB], hasMore: false })
    mocks.getLead.mockResolvedValue({ ...leadA, message: 'Please call me.' })
    mocks.deleteLead.mockResolvedValue(undefined)
    mocks.getLeadNotes.mockResolvedValue({ notes: [], hasMore: false })
  })

  it('confirms lead delete, skips the API on cancel, and removes the id after 204', async () => {
    render(<BusinessLeads autoLoad tenantId="tenant-1" />)
    expect(await screen.findByText('Jamie Visitor')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Jamie Visitor/ }))
    expect(await screen.findByRole('heading', { name: 'Jamie Visitor' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete this lead?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.deleteLead).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete lead' }))
    await waitFor(() => expect(mocks.deleteLead).toHaveBeenCalledWith('tenant-1', 'lead-1'))
    expect(await screen.findByText('Other Visitor')).toBeInTheDocument()
    expect(screen.queryByText('Jamie Visitor')).not.toBeInTheDocument()
  })
})
