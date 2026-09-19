'use client'

import type { ReactNode } from 'react'

export function SegmentedControl<T extends string> ({ ariaLabel, disabled, onChange, options, value }: {
  ariaLabel: string
  disabled?: boolean
  onChange: (value: T) => void
  options: readonly { label: string, value: T }[]
  value: T
}) {
  return <div aria-label={ariaLabel} className="grid grid-flow-col auto-cols-fr rounded-md border border-border bg-surface-muted p-1" role="group">
    {options.map((option) => <button aria-label={option.label} aria-pressed={value === option.value} className={`min-h-9 rounded px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-focus ${value === option.value ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'} disabled:cursor-not-allowed disabled:opacity-60`} disabled={disabled} key={option.value} onClick={() => onChange(option.value)} type="button">{option.label}</button>)}
  </div>
}

export function ToggleRow ({ checked, children, disabled, onChange }: { checked: boolean, children: ReactNode, disabled?: boolean, onChange: (checked: boolean) => void }) {
  return <label className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2 text-sm font-medium text-fg ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
    <span>{children}</span><input aria-label={typeof children === 'string' ? children : undefined} checked={checked} className="peer sr-only" disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full bg-border-strong transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-focus peer-disabled:opacity-60 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-xs after:transition-transform peer-checked:after:translate-x-4" />
  </label>
}

export function OptionRow ({ checked, children, disabled, name, onChange, value }: { checked: boolean, children: ReactNode, disabled?: boolean, name: string, onChange: () => void, value: string }) {
  return <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${checked ? 'border-focus bg-surface-muted text-fg' : 'border-border bg-surface text-fg-muted'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
    <input aria-label={value === 'header' ? 'Use header navigation' : value === 'custom' ? 'Custom navigation' : 'No navigation'} checked={checked} className="mt-0.5" disabled={disabled} name={name} onChange={onChange} type="radio" value={value} /><span>{children}</span>
  </label>
}
