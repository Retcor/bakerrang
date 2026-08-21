'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  children: ReactNode
  description?: ReactNode
  onClose: () => void
  open: boolean
  title: ReactNode
}

export function Dialog ({ children, description, onClose, open, title }: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(focusable)
    ;(first ?? panel)?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(focusable))
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault(); lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault(); firstItem.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus.current?.focus()
    }
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close dialog" className="absolute inset-0 cursor-default bg-sidebar-deep/65" onClick={onClose} type="button" />
      <div aria-describedby={description ? descriptionId : undefined} aria-labelledby={titleId} aria-modal="true" className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-md" ref={panelRef} role="dialog" tabIndex={-1}>
        <h2 className="text-xl font-semibold tracking-tight text-fg" id={titleId}>{title}</h2>
        {description && <div className="mt-2 text-sm leading-6 text-fg-muted" id={descriptionId}>{description}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
