import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-accent text-accent-fg shadow-xs hover:bg-brand-hover active:bg-brand-active',
  secondary: 'border border-border-strong bg-surface text-fg shadow-xs hover:bg-surface-muted',
  ghost: 'border border-transparent bg-transparent text-fg hover:bg-surface-muted',
  danger: 'border border-transparent bg-danger text-danger-contrast shadow-xs hover:opacity-90'
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base'
}

export function Button ({ className = '', size = 'md', type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      type={type}
      {...props}
    />
  )
}
