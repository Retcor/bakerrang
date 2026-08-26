import type { HTMLAttributes } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { tone?: BadgeTone }

const tones: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-muted text-fg-muted',
  success: 'border-success/20 bg-success-subtle text-success-fg',
  warning: 'border-warning/20 bg-warning-subtle text-warning-fg',
  danger: 'border-danger/20 bg-danger-subtle text-danger-fg',
  info: 'border-info/20 bg-info-subtle text-info-fg'
}

export function Badge ({ className = '', tone = 'neutral', ...props }: BadgeProps) {
  return <span className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`} {...props} />
}
