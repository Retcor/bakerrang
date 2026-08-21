'use client'

import { Button } from './Button'
import { Dialog } from './Dialog'

export interface ConfirmDialogProps {
  busy?: boolean
  confirmLabel?: string
  description: string
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: string
}

export function ConfirmDialog ({ busy = false, confirmLabel = 'Confirm', description, onCancel, onConfirm, open, title }: ConfirmDialogProps) {
  return (
    <Dialog description={description} onClose={onCancel} open={open} title={title}>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={busy} onClick={onCancel} variant="secondary">Cancel</Button>
        <Button disabled={busy} onClick={onConfirm} variant="danger">{busy ? 'Working…' : confirmLabel}</Button>
      </div>
    </Dialog>
  )
}
