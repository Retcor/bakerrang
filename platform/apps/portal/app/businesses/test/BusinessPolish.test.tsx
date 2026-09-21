import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode, href: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>
}))
vi.mock('../../_shell/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>
}))
import { BusinessOverview } from '../BusinessWorkspace'

describe('business workspace polish', () => {
  it('uses action-specific business overview links', () => {
    render(<BusinessOverview tenantId="bakery-1" />)

    expect(screen.getByRole('link', { name: /Manage website/ })).toHaveAttribute('href', '/businesses/bakery-1/website')
    expect(screen.getByRole('link', { name: /Review leads/ })).toHaveAttribute('href', '/businesses/bakery-1/leads')
    expect(screen.getByRole('link', { name: /Manage domain/ })).toHaveAttribute('href', '/businesses/bakery-1/domain')
  })
})
