import type { ReactNode } from 'react'

export function StatusMessage ({ children, tone = 'neutral' }: { children: ReactNode, tone?: 'neutral' | 'error' | 'success' }) {
  const style = tone === 'error' ? 'bg-danger-subtle text-danger-fg' : tone === 'success' ? 'bg-success-subtle text-success-fg' : 'bg-surface-muted text-fg-muted'
  return <p className={`rounded-md px-3 py-2 text-sm ${style}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>
}
