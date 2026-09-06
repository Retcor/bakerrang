'use client'

import { useState } from 'react'
import { Button, Dialog, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { addSection } from '../../lib/site'
import type { SectionType, SiteDefinition } from '@bakerrang/site-schema'
import { sectionDefinitions, sectionTypes, homeSections } from './sectionDefinitions'

export function AddSectionDialog ({ onAdded, onClose, onRefresh, open, site, tenantId }: {
  onAdded: (site: SiteDefinition, sectionId: string) => void
  onClose: () => void
  onRefresh: () => Promise<SiteDefinition>
  open: boolean
  site: SiteDefinition
  tenantId: string
}) {
  const [pending, setPending] = useState<SectionType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sections = homeSections(site)
  const add = async (type: SectionType) => {
    if (pending) return
    setPending(type); setError(null)
    try {
      const result = await addSection(tenantId, type)
      onAdded(result.site, result.sectionId)
      onClose()
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        try { await onRefresh() } catch {}
        setError(caught.message || 'The homepage changed. Review the current sections and try again.')
      } else setError('Unable to add this section. Please try again.')
    } finally { setPending(null) }
  }
  return <Dialog description="Add a section to the homepage. The new section opens in its exact editor after it is created." onClose={onClose} open={open} title="Add homepage section">
    <div className="space-y-3">
      {sectionTypes.map((type) => {
        const definition = sectionDefinitions[type]
        const exists = sections.some((section) => section.type === type)
        const blocked = definition.singleton && exists
        const hoursBlocked = type === 'businessHours' && !site.businessProfile?.businessHours
        const disabled = blocked || hoursBlocked || Boolean(pending)
        const reason = blocked ? 'Already added' : hoursBlocked ? 'Set a weekly schedule in Site setup first' : null
        return <div className="rounded-md border border-border p-3" key={type}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-fg">{definition.label}</p><p className="mt-1 text-sm text-fg-muted">{definition.description}</p>{reason && <p className="mt-1 text-xs text-fg-subtle">{reason}{hoursBlocked && <> · <a className="font-semibold underline" href="?editor=businessHours">Open Site setup</a></>}</p>}</div>
            <Button disabled={disabled} onClick={() => void add(type)} size="sm" type="button">{pending === type ? 'Adding…' : 'Add'}</Button>
          </div>
        </div>
      })}
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
    </div>
  </Dialog>
}
