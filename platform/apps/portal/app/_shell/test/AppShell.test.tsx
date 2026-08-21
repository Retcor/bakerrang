import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signOut: vi.fn(),
  status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading',
  user: { displayName: 'Jamie Baker', email: 'jamie@example.com' } as { displayName: string, email: string } | null
}))
const navigation = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('next/image', () => ({ default: ({ src }: { src: string }) => <span data-image-src={src} /> }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode, href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>
}))
vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({
    signOut: auth.signOut,
    status: auth.status,
    user: auth.user
  })
}))

import { AppShell } from '../AppShell'

describe('AppShell mobile drawer', () => {
  beforeEach(() => {
    navigation.pathname = '/'
    auth.status = 'authenticated'
    auth.user = { displayName: 'Jamie Baker', email: 'jamie@example.com' }
  })

  it('exposes open state, closes with Escape, and restores focus', async () => {
    render(<AppShell><h1>Businesses</h1></AppShell>)
    const opener = screen.getByRole('button', { name: 'Open navigation' })
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(opener)
    expect(opener).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  it('closes from its explicit close control', async () => {
    render(<AppShell><h1>Businesses</h1></AppShell>)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const closeButtons = screen.getAllByRole('button', { name: 'Close navigation' })
    fireEvent.click(closeButtons.at(-1)!)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes when the current pathname changes', async () => {
    const view = render(<AppShell><h1>Businesses</h1></AppShell>)
    const opener = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(opener)
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument()

    navigation.pathname = '/businesses/example'
    view.rerender(<AppShell><h1>Business overview</h1></AppShell>)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  it('uses brand contrast for active navigation and keeps sign out sidebar-specific', () => {
    render(<AppShell><h1>Businesses</h1></AppShell>)

    expect(screen.getByRole('link', { name: 'Businesses' })).toHaveClass('bg-brand', 'text-brand-ink')
    expect(screen.getByRole('link', { name: 'BakerRang businesses' })).not.toHaveClass('bg-sidebar')
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveClass(
      '!bg-transparent',
      '!text-sidebar-fg',
      'hover:!bg-sidebar-deep',
      'focus-visible:!outline-brand'
    )
  })

  it('renders the simplified light-surface login brand and Google action', () => {
    auth.status = 'anonymous'
    auth.user = null
    render(<AppShell><h1>Hidden workspace</h1></AppShell>)

    expect(screen.getByText('Baker')).toHaveClass('text-fg')
    expect(screen.getByText('Rang')).toHaveClass('text-brand')
    expect(screen.getByText('Always Visible, Always Relevant')).toBeInTheDocument()
    expect(screen.queryByText('Business workspace')).not.toBeInTheDocument()
    const signIn = screen.getByRole('button', { name: 'Sign in with Google' })
    expect(signIn).toHaveClass('bg-surface', 'text-fg')
    expect(signIn.querySelector('[data-image-src="/google-g.svg"]')).toBeInTheDocument()
  })

})
