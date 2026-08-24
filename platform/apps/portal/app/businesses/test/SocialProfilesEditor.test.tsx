import type { SiteDefinition, SocialLink } from '@bakerrang/site-schema'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ updateSocialLinks: vi.fn() }))
vi.mock('../../../lib/site', () => ({ updateSocialLinks: mocks.updateSocialLinks }))

import { SocialProfilesEditor } from '../SocialProfilesEditor'

const theme = {
  colors: { primary: '#334155', accent: '#0f766e', background: '#f8fafc', text: '#172033' },
  headingFont: 'inter' as const, bodyFont: 'inter' as const, cornerStyle: 'soft' as const,
  contentWidth: 'standard' as const, sectionSpacing: 'comfortable' as const
}
const links: SocialLink[] = [
  { platform: 'instagram', url: 'https://instagram.com/example' },
  { platform: 'facebook', url: 'https://facebook.com/example' }
]
const site = (socialLinks?: SocialLink[]): SiteDefinition => ({
  status: 'DRAFT',
  branding: { siteName: 'Bakery', primaryColor: '#334155', accentColor: '#0f766e' },
  theme,
  ...(socialLinks ? { businessProfile: { socialLinks } } : {}),
  pages: [{ id: 'home', slug: '/', title: 'Home', sections: [
    { id: 'hero', type: 'hero', content: { title: 'Welcome' } }
  ] }]
})

describe('Social Profiles editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateSocialLinks.mockResolvedValue(site(links))
  })

  it('starts empty, exposes supported labels through Add, and does not persist locally', () => {
    render(<SocialProfilesEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    expect(screen.getByText('No social profiles configured.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add Social Profile' }))
    expect(screen.getByLabelText('Platform')).toHaveValue('facebook')
    expect(within(screen.getByLabelText('Platform')).getByRole('option', { name: 'Facebook' })).toBeInTheDocument()
    for (const label of ['Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'X']) {
      expect(within(screen.getByLabelText('Platform')).getByRole('option', { name: label })).toBeInTheDocument()
    }
    expect(mocks.updateSocialLinks).not.toHaveBeenCalled()
  })

  it('loads ordered links, excludes configured platforms from other selectors, and is mobile-safe', () => {
    render(<SocialProfilesEditor onCancel={() => undefined} onSaved={() => undefined} site={site(links)} tenantId="tenant-1" />)
    const selectors = screen.getAllByLabelText('Platform')
    expect(selectors[0]).toHaveValue('instagram')
    expect(selectors[1]).toHaveValue('facebook')
    expect(within(selectors[0]).queryByRole('option', { name: 'Facebook' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Instagram URL')).toHaveValue('https://instagram.com/example')
    expect(screen.getByLabelText('Instagram URL').closest('fieldset')).toHaveClass('grid', 'md:grid-cols-[9rem_minmax(0,1fr)_auto]')
    expect(screen.getByRole('button', { name: 'Move Instagram profile up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Facebook profile down' })).toBeDisabled()
  })

  it('edits, reorders, removes, and saves ordered canonical links through the focused endpoint', async () => {
    const onSaved = vi.fn()
    render(<SocialProfilesEditor onCancel={() => undefined} onSaved={onSaved} site={site(links)} tenantId="tenant-1" />)
    fireEvent.change(screen.getByLabelText('Instagram URL'), { target: { value: ' https://instagram.com/updated ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Facebook profile up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Facebook profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSocialLinks).toHaveBeenCalledWith('tenant-1', {
      socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/updated' }]
    }))
    expect(onSaved).toHaveBeenCalledWith(site(links))
  })

  it('shows row-specific HTTPS validation and does not call the API', () => {
    render(<SocialProfilesEditor onCancel={() => undefined} onSaved={() => undefined} site={site()} tenantId="tenant-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Social Profile' }))
    fireEvent.change(screen.getByLabelText('Facebook URL'), { target: { value: 'http://facebook.com/example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Facebook URL must use HTTPS')
    expect(mocks.updateSocialLinks).not.toHaveBeenCalled()
  })

  it('disables adding a seventh platform', () => {
    const all: SocialLink[] = [
      { platform: 'facebook', url: 'https://facebook.com/example' },
      { platform: 'instagram', url: 'https://instagram.com/example' },
      { platform: 'linkedin', url: 'https://linkedin.com/company/example' },
      { platform: 'youtube', url: 'https://youtube.com/@example' },
      { platform: 'tiktok', url: 'https://tiktok.com/@example' },
      { platform: 'x', url: 'https://x.com/example' }
    ]
    render(<SocialProfilesEditor onCancel={() => undefined} onSaved={() => undefined} site={site(all)} tenantId="tenant-1" />)
    expect(screen.getByRole('button', { name: 'Add Social Profile' })).toBeDisabled()
  })

  it('Save with zero rows sends the documented canonical removal contract', async () => {
    render(<SocialProfilesEditor onCancel={() => undefined} onSaved={() => undefined} site={site(links)} tenantId="tenant-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Instagram profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Facebook profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateSocialLinks).toHaveBeenCalledWith('tenant-1', { socialLinks: null }))
  })
})
