'use client'

import type { MouseEvent, ReactNode } from 'react'

/** Editor-only interaction layer; display:contents adds no visual box. */
export function SectionSelectionBoundary ({ children, onSelect, sectionId }: {
  children: ReactNode
  onSelect: (sectionId: string) => void
  sectionId: string
}) {
  const select = (event: MouseEvent<HTMLDivElement>) => {
    if (!event.defaultPrevented) onSelect(sectionId)
  }
  return <div data-br-preview-section={sectionId} onClick={select} style={{ display: 'contents' }}>{children}</div>
}
