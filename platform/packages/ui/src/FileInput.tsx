import { forwardRef, type InputHTMLAttributes } from 'react'

export interface FileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> {
  buttonLabel?: string
  className?: string
  emptyLabel?: string
  fileName?: string | null
  id: string
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput ({
  'aria-describedby': describedBy,
  buttonLabel = 'Choose image',
  className = '',
  disabled,
  emptyLabel = 'No image selected',
  fileName,
  id,
  ...props
}, ref) {
  const statusId = `${id}-file-status`
  const description = [describedBy, statusId].filter(Boolean).join(' ')
  const displayName = fileName || emptyLabel

  return (
    <div className={`flex min-w-0 flex-col gap-3 rounded-md border border-border-strong bg-surface-muted p-3 sm:flex-row sm:items-center ${className}`}>
      <input
        aria-describedby={description}
        className="peer sr-only"
        disabled={disabled}
        id={id}
        ref={ref}
        type="file"
        {...props}
      />
      <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-fg shadow-xs transition-colors hover:bg-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-50" htmlFor={id}>
        {buttonLabel}
      </label>
      <span aria-live="polite" className="min-w-0 break-all text-sm text-fg-muted sm:truncate" id={statusId} title={displayName}>
        {displayName}
      </span>
    </div>
  )
})
