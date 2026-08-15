'use client'

import { useState, type FormEvent } from 'react'
import { findHomePage, isHeroSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button, Input } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateHomeHero } from '../../lib/site'

export interface HeroEditorProps {
  tenantId: string
  site: SiteDefinition
  onCancel: () => void
  onSaved: (site: SiteDefinition) => void
}

export function HeroEditor ({ tenantId, site, onCancel, onSaved }: HeroEditorProps) {
  const home = findHomePage(site)
  const hero = home?.sections.find(isHeroSection)
  const [title, setTitle] = useState(hero?.content.title ?? '')
  const [subtitle, setSubtitle] = useState(hero?.content.subtitle ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!hero) {
    return <p className="max-w-80 text-sm text-fg" role="alert">The Home Hero is unavailable.</p>
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Headline is required.')
      return
    }
    if (trimmedTitle.length > 200) {
      setError('Headline must be 200 characters or fewer.')
      return
    }
    if (subtitle.length > 500) {
      setError('Subtitle must be 500 characters or fewer.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      onSaved(await updateHomeHero(tenantId, { title: trimmedTitle, subtitle }))
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save the Hero. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="w-full max-w-lg rounded-md border border-border bg-surface p-4 text-left"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="text-sm font-semibold text-fg" htmlFor={`hero-title-${tenantId}`}>
        Headline
      </label>
      <Input
        className="mt-2"
        disabled={saving}
        id={`hero-title-${tenantId}`}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        value={title}
      />

      <label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`hero-subtitle-${tenantId}`}>
        Subtitle
      </label>
      <textarea
        className="mt-2 min-h-28 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        disabled={saving}
        id={`hero-subtitle-${tenantId}`}
        maxLength={500}
        onChange={(event) => setSubtitle(event.target.value)}
        value={subtitle}
      />

      {error && <p className="mt-3 text-sm text-fg" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </Button>
        <Button className="min-h-9 px-3 py-1.5 text-xs" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
