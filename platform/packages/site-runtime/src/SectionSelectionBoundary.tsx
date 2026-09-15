'use client'

import type { MouseEvent, ReactNode } from 'react'

/** Editor-only interaction layer; display:contents adds no visual box. */
export function SectionSelectionBoundary ({ children, label, onSelect, sectionId, selected = false }: {
  children: ReactNode
  label: string
  onSelect: (sectionId: string) => void
  sectionId: string
  selected?: boolean
}) {
  const select = (event: MouseEvent<HTMLDivElement>) => {
    if (!event.defaultPrevented) onSelect(sectionId)
  }
  if (!selected) return <div data-br-preview-section={sectionId} onClick={select} style={{ display: 'contents' }}>{children}</div>
  return (
    <div data-br-editor-selection={sectionId} data-br-preview-section={sectionId} onClick={select} style={{ borderRadius: 'inherit', position: 'relative' }}>
      <span aria-hidden="true" data-br-editor-selection-outline="" style={{ border: '2px solid #ffd500', borderRadius: 'inherit', boxSizing: 'border-box', inset: 0, pointerEvents: 'none', position: 'absolute', zIndex: 1 }} />
      <span aria-hidden="true" data-br-editor-selection-label="" style={{ background: '#ffd500', borderRadius: '4px 4px 0 0', color: '#1c1f29', fontFamily: 'system-ui, sans-serif', fontSize: '11px', fontWeight: 600, left: '2px', lineHeight: 1.2, padding: '3px 8px', pointerEvents: 'none', position: 'absolute', top: '2px', transform: 'translateY(-100%)', zIndex: 2 }}>{label} • selected</span>
      {children}
    </div>
  )
}
