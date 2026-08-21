import { cloneElement, type ReactElement, type ReactNode } from 'react'

type FieldControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export interface FieldProps {
  children: ReactElement<FieldControlProps>
  error?: ReactNode
  help?: ReactNode
  id: string
  label: ReactNode
  optional?: boolean
  className?: string
}

export function Field ({ children, className = '', error, help, id, label, optional = false }: FieldProps) {
  const descriptionId = error ? `${id}-error` : help ? `${id}-help` : undefined
  return (
    <div className={className}>
      <label className="flex items-baseline justify-between gap-3 text-sm font-semibold text-fg" htmlFor={id}>
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-fg-subtle">Optional</span>}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': descriptionId,
        'aria-invalid': Boolean(error)
      })}
      {error ? <p className="mt-2 text-sm text-danger-fg" id={descriptionId} role="alert">{error}</p>
        : help ? <p className="mt-2 text-sm text-fg-muted" id={descriptionId}>{help}</p> : null}
    </div>
  )
}
