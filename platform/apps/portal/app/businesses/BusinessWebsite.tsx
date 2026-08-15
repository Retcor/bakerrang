'use client'

import { useState } from 'react'
import { findHomePage, isContactSection, isServicesSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Button } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import {
  getSite,
  initializeSite,
  publishSite,
  unpublishSite
} from '../../lib/site'
import { HeroEditor } from './HeroEditor'
import { ServicesEditor } from './ServicesEditor'
import { ContactEditor } from './ContactEditor'

export interface BusinessWebsiteProps {
  tenantId: string
}

type View = 'initial' | 'missing' | 'site'
type Operation = 'manage' | 'initialize' | 'publish' | 'unpublish'
type EditorMode = 'hero' | 'services' | 'contact' | null

export function BusinessWebsite ({ tenantId }: BusinessWebsiteProps) {
  const [view, setView] = useState<View>('initial')
  const [site, setSite] = useState<SiteDefinition | null>(null)
  const [pending, setPending] = useState<Operation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorMode>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const run = async (
    operation: Operation,
    action: () => Promise<SiteDefinition>,
    message: string
  ) => {
    if (pending) return
    setPending(operation)
    setError(null)
    setFeedback(null)
    try {
      const definition = await action()
      setSite(definition)
      setView('site')
    } catch {
      setError(message)
    } finally {
      setPending(null)
    }
  }

  const handleManage = async () => {
    if (pending) return
    setPending('manage')
    setError(null)
    try {
      setSite(await getSite(tenantId))
      setView('site')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setView('missing')
      } else {
        setError('Unable to load the website. Please try again.')
      }
    } finally {
      setPending(null)
    }
  }

  const handleInitialize = async () => {
    if (pending) return
    setPending('initialize')
    setError(null)
    try {
      setSite(await initializeSite(tenantId))
      setView('site')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        try {
          setSite(await getSite(tenantId))
          setView('site')
          return
        } catch {
          setError('Unable to load the existing website. Please try again.')
          return
        }
      }
      setError('Unable to initialize the website. Please try again.')
    } finally {
      setPending(null)
    }
  }

  if (view === 'initial') {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          className="min-h-9 px-3 py-1.5 text-xs"
          disabled={Boolean(pending)}
          onClick={() => void handleManage()}
        >
          {pending === 'manage' ? 'Loading…' : 'Manage Website'}
        </Button>
        {error && <p className="max-w-64 text-xs text-fg" role="alert">{error}</p>}
      </div>
    )
  }

  if (view === 'missing') {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          className="min-h-9 px-3 py-1.5 text-xs"
          disabled={Boolean(pending)}
          onClick={() => void handleInitialize()}
        >
          {pending === 'initialize' ? 'Initializing…' : 'Initialize Website'}
        </Button>
        {error && <p className="max-w-64 text-xs text-fg" role="alert">{error}</p>}
      </div>
    )
  }

  const published = site?.status === 'PUBLISHED'
  const home = site ? findHomePage(site) : undefined
  const services = home?.sections.find(isServicesSection)
  const contact = home?.sections.find(isContactSection)
  const handleEditorSaved = (definition: SiteDefinition) => {
    setSite(definition)
    setEditor(null)
    setError(null)
    setFeedback(definition.status === 'PUBLISHED'
      ? 'Saved to the working site. Republish to change the public site.'
      : 'Changes saved.')
  }
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <span className="w-fit rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-fg-muted">
        Website: {site?.status}
      </span>
      {editor === 'hero' && site ? (
        <HeroEditor
          onCancel={() => setEditor(null)}
          onSaved={handleEditorSaved}
          site={site}
          tenantId={tenantId}
        />
      ) : editor === 'services' && site ? (
        <ServicesEditor
          onCancel={() => setEditor(null)}
          onSaved={handleEditorSaved}
          site={site}
          tenantId={tenantId}
        />
      ) : editor === 'contact' && site ? (
        <ContactEditor
          onCancel={() => setEditor(null)}
          onSaved={handleEditorSaved}
          site={site}
          tenantId={tenantId}
        />
      ) : (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('hero')
              setError(null)
              setFeedback(null)
            }}
          >
            Edit Hero
          </Button>
          <Button
            className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('services')
              setError(null)
              setFeedback(null)
            }}
          >
            {services ? 'Edit Services' : 'Add Services'}
          </Button>
          <Button
            className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('contact')
              setError(null)
              setFeedback(null)
            }}
          >
            {contact ? 'Edit Contact' : 'Add Contact'}
          </Button>
          <Button
            className="min-h-9 px-3 py-1.5 text-xs"
            disabled={Boolean(pending)}
            onClick={() => void run(
              'publish',
              () => publishSite(tenantId),
              'Unable to publish the website. Please try again.'
            )}
          >
            {pending === 'publish' ? 'Publishing…' : published ? 'Republish' : 'Publish'}
          </Button>
          {published && (
            <Button
              className="min-h-9 border border-border bg-surface px-3 py-1.5 text-xs text-fg"
              disabled={Boolean(pending)}
              onClick={() => void run(
                'unpublish',
                () => unpublishSite(tenantId),
                'Unable to unpublish the website. Please try again.'
              )}
            >
              {pending === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
            </Button>
          )}
        </div>
      )}
      {error && <p className="max-w-64 text-xs text-fg" role="alert">{error}</p>}
      {feedback && <p className="max-w-80 text-xs text-fg-muted" role="status">{feedback}</p>}
    </div>
  )
}
