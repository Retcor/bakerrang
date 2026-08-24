'use client'

import { Button } from '@bakerrang/ui'

export interface RowAction {
  disabled?: boolean
  label: string
  onClick: () => void
}

export interface RowActionsProps {
  className?: string
  moveDown?: RowAction
  moveUp?: RowAction
  remove?: RowAction
}

function ArrowIcon ({ direction }: { direction: 'up' | 'down' }) {
  return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 20 20"><path d={direction === 'up' ? 'm5 12.5 5-5 5 5' : 'm5 7.5 5 5 5-5'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
}

function TrashIcon () {
  return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 20 20"><path d="M4.5 6h11M8 3.75h4M6 6l.6 10.25h6.8L14 6M8.25 8.5v5M11.75 8.5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
}

export function RowActions ({ className = '', moveDown, moveUp, remove }: RowActionsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {moveUp && <Button aria-label={moveUp.label} className="min-h-11 min-w-11 px-3" disabled={moveUp.disabled} onClick={moveUp.onClick} type="button" variant="secondary"><ArrowIcon direction="up" /></Button>}
      {moveDown && <Button aria-label={moveDown.label} className="min-h-11 min-w-11 px-3" disabled={moveDown.disabled} onClick={moveDown.onClick} type="button" variant="secondary"><ArrowIcon direction="down" /></Button>}
      {remove && <Button aria-label={remove.label} className="min-h-11 min-w-11 px-3" disabled={remove.disabled} onClick={remove.onClick} type="button" variant="danger"><TrashIcon /></Button>}
    </div>
  )
}
