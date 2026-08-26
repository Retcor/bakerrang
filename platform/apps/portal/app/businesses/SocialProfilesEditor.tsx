'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { SiteDefinition, SocialLink, SocialPlatform } from '@bakerrang/site-schema'
import { Button, Input, Select } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSocialLinks } from '../../lib/site'
import { RowActions } from './RowActions'
import { WebsiteEditorShell } from './WebsiteEditorShell'

export const socialPlatforms: ReadonlyArray<{ value: SocialPlatform, label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X' }
]

interface EditorRow extends SocialLink { key: string }

const platformLabel = (platform: SocialPlatform) =>
  socialPlatforms.find((item) => item.value === platform)?.label ?? platform

export function SocialProfilesEditor ({ onCancel, onDirtyChange = () => {}, onSaved, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const nextKey = useRef(0)
  const [rows, setRows] = useState<EditorRow[]>(() => (site.businessProfile?.socialLinks ?? []).map((link) => ({
    ...link,
    key: `existing-${link.platform}`
  })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const used = new Set(rows.map((row) => row.platform))
  const available = socialPlatforms.filter((platform) => !used.has(platform.value))

  const updateRow = (key: string, update: Partial<Pick<EditorRow, 'platform' | 'url'>>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...update } : row))
  }

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const validate = () => {
    const seen = new Set<SocialPlatform>()
    for (const row of rows) {
      const label = platformLabel(row.platform)
      if (seen.has(row.platform)) return `${label} can only be configured once.`
      seen.add(row.platform)
      const url = row.url.trim()
      if (!url) return `${label} URL is required.`
      if (url.length > 300) return `${label} URL must be 300 characters or fewer.`
      try {
        const parsed = new URL(url)
        if (!/^https:\/\//i.test(url) || parsed.protocol !== 'https:') return `${label} URL must use HTTPS.`
      } catch {
        return `${label} URL must be a valid HTTPS URL.`
      }
    }
    return null
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const validationError = validate()
    if (validationError) return setError(validationError)
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateSocialLinks(tenantId, {
        socialLinks: rows.length
          ? rows.map(({ platform, url }) => ({ platform, url: url.trim() }))
          : null
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400
        ? caught.message
        : 'Unable to save Social Profiles. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WebsiteEditorShell dirtyValue={rows.map(({ platform, url }) => ({ platform, url: url.trim() }))} editor="socialProfiles" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving} width="wide">
      <p className="text-sm leading-6 text-fg-muted">Add HTTPS links to profiles that should appear in the public website footer and search-engine business data.</p>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-border-strong bg-surface-muted p-5 text-sm text-fg-muted">No social profiles configured.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row, index) => {
            const label = platformLabel(row.platform)
            const options = socialPlatforms.filter((platform) => platform.value === row.platform || !used.has(platform.value))
            return (
              <fieldset className="grid min-w-0 gap-3 rounded-md border border-border p-4 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-end" disabled={saving} key={row.key}>
                <legend className="sr-only">{label} profile</legend>
                <div className="min-w-0"><label className="text-sm font-semibold text-fg" htmlFor={`social-platform-${tenantId}-${row.key}`}>Platform</label><Select className="mt-2 min-w-0" id={`social-platform-${tenantId}-${row.key}`} onChange={(event) => updateRow(row.key, { platform: event.target.value as SocialPlatform })} value={row.platform}>{options.map((platform) => <option key={platform.value} value={platform.value}>{platform.label}</option>)}</Select></div>
                <div className="min-w-0"><label className="text-sm font-semibold text-fg" htmlFor={`social-url-${tenantId}-${row.key}`}>{label} URL</label><Input className="mt-2 min-w-0" id={`social-url-${tenantId}-${row.key}`} maxLength={300} onChange={(event) => updateRow(row.key, { url: event.target.value })} placeholder="https://" type="url" value={row.url} /></div>
                <RowActions className="md:justify-end" moveUp={{ label: `Move ${label} profile up`, onClick: () => moveRow(index, -1), disabled: index === 0 }} moveDown={{ label: `Move ${label} profile down`, onClick: () => moveRow(index, 1), disabled: index === rows.length - 1 }} remove={{ label: `Remove ${label} profile`, onClick: () => setRows((current) => current.filter((item) => item.key !== row.key)) }} />
              </fieldset>
            )
          })}
        </div>
      )}

      <Button className="mt-4" disabled={saving || available.length === 0} onClick={() => {
        const platform = available[0]
        if (!platform) return
        setRows((current) => [...current, { key: `new-${nextKey.current++}`, platform: platform.value, url: '' }])
      }} type="button" variant="secondary">Add Social Profile</Button>
    </WebsiteEditorShell>
  )
}
