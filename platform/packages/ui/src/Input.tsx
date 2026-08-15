import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input ({ className = '', type = 'text', ...props }: InputProps) {
  return (
    <input
      className={`min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      type={type}
      {...props}
    />
  )
}
