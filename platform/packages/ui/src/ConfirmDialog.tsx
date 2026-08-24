'use client'

import { Button } from './Button'
import { Dialog } from './Dialog'

export interface ConfirmDialogProps {
  busy?: boolean
  cancelLabel?: string
  confirmLabel?: string
  description: string
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: string
}

export function ConfirmDialog ({ busy = false, cancelLabel = 'Cancel', confirmLabel = 'Confirm', description, onCancel, onConfirm, open, title }: ConfirmDialogProps) {
  return (
    <Dialog description={description} onClose={onCancel} open={open} title={title}>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} variant="secondary">{cancelLabel}</Button>
        <Button disabled={busy} onClick={onConfirm} variant="danger">{busy ? 'Working…' : confirmLabel}</Button>
      </div>
    </Dialog>
  )
}
