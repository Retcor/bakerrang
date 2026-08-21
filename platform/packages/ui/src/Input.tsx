import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input ({ className = '', type = 'text', ...props }: InputProps) {
  return (
    <input
      className={`min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-fg shadow-xs outline-none transition-colors placeholder:text-fg-subtle focus:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${className}`}
      type={type}
      {...props}
    />
  )
}
