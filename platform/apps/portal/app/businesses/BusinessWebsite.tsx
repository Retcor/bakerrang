'use client'

import { useEffect, useState } from 'react'
import { findHomePage, isContactSection, isGallerySection, isServicesSection, isTestimonialsSection, type SiteDefinition } from '@bakerrang/site-schema'
import { Badge, Button, Card, StatusMessage } from '@bakerrang/ui'
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
import { GalleryEditor } from './GalleryEditor'
import { TestimonialsEditor } from './TestimonialsEditor'
import { SectionCompositionEditor } from './SectionCompositionEditor'
import { BrandingEditor } from './BrandingEditor'
import { BusinessProfileEditor } from './BusinessProfileEditor'

export interface BusinessWebsiteProps {
  tenantId: string
  autoLoad?: boolean
}

type View = 'initial' | 'missing' | 'site'
type Operation = 'manage' | 'initialize' | 'publish' | 'unpublish'
type EditorMode = 'branding' | 'profile' | 'hero' | 'services' | 'gallery' | 'testimonials' | 'contact' | 'composition' | null

export function BusinessWebsite ({ autoLoad = false, tenantId }: BusinessWebsiteProps) {
  const [view, setView] = useState<View>('initial')
  const [site, setSite] = useState<SiteDefinition | null>(null)
  const [pending, setPending] = useState<Operation | null>(autoLoad ? 'manage' : null)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorMode>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!autoLoad) return
    let cancelled = false
    void getSite(tenantId).then((definition) => {
      if (cancelled) return
      setSite(definition)
      setView('site')
    }).catch((caught: unknown) => {
      if (cancelled) return
      if (caught instanceof ApiError && caught.status === 404) setView('missing')
      else setError('Unable to load the website. Please try again.')
    }).finally(() => { if (!cancelled) setPending(null) })
    return () => { cancelled = true }
  }, [autoLoad, tenantId])

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
    if (autoLoad) return <StatusMessage>Loading website…</StatusMessage>
    return (
      <div>
        <Button disabled={Boolean(pending)} onClick={() => void handleManage()} size="sm">
          {pending === 'manage' ? 'Loading…' : 'Manage Website'}
        </Button>
        {error && <div className="mt-3"><StatusMessage tone="error">{error}</StatusMessage></div>}
      </div>
    )
  }

  if (view === 'missing') {
    return (
      <Card className="p-6 text-left">
        <h2 className="text-lg font-semibold text-fg">Initialize this website</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">Create the working site before adding content or publishing.</p>
        <Button className="mt-5" disabled={Boolean(pending)} onClick={() => void handleInitialize()}>
          {pending === 'initialize' ? 'Initializing…' : 'Initialize Website'}
        </Button>
        {error && <div className="mt-3"><StatusMessage tone="error">{error}</StatusMessage></div>}
      </Card>
    )
  }

  const published = site?.status === 'PUBLISHED'
  const home = site ? findHomePage(site) : undefined
  const services = home?.sections.find(isServicesSection)
  const contact = home?.sections.find(isContactSection)
  const gallery = home?.sections.find(isGallerySection)
  const testimonials = home?.sections.find(isTestimonialsSection)
  const handleEditorSaved = (definition: SiteDefinition) => {
    setSite(definition)
    setEditor(null)
    setError(null)
    setFeedback(definition.status === 'PUBLISHED'
      ? 'Saved to the working site. Republish to change the public site.'
      : 'Changes saved.')
  }
  return (
    <div className="w-full">
      <div className="mb-5"><Badge tone={published ? 'success' : 'warning'}>Website: {site?.status}</Badge></div>
      {editor === 'branding' && site ? (
        <BrandingEditor onCancel={() => setEditor(null)} onSaved={handleEditorSaved} site={site} tenantId={tenantId} />
      ) : editor === 'profile' && site ? (
        <BusinessProfileEditor onCancel={() => setEditor(null)} onSaved={handleEditorSaved} site={site} tenantId={tenantId} />
      ) : editor === 'hero' && site ? (
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
      ) : editor === 'gallery' && site ? (
        <GalleryEditor
          onCancel={() => setEditor(null)}
          onSaved={handleEditorSaved}
          site={site}
          tenantId={tenantId}
        />
      ) : editor === 'testimonials' && site ? (
        <TestimonialsEditor
          onCancel={() => setEditor(null)}
          onSaved={handleEditorSaved}
          site={site}
          tenantId={tenantId}
        />
      ) : editor === 'composition' && site ? (
        <SectionCompositionEditor
          onCancel={() => setEditor(null)}
          onSaved={handleEditorSaved}
          site={site}
          tenantId={tenantId}
        />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby={`site-foundation-${tenantId}`}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-fg-subtle" id={`site-foundation-${tenantId}`}>Site foundation</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="secondary" disabled={Boolean(pending)} onClick={() => { setEditor('branding'); setError(null); setFeedback(null) }}>Branding</Button>
          <Button variant="secondary" disabled={Boolean(pending)} onClick={() => { setEditor('profile'); setError(null); setFeedback(null) }}>Business Profile</Button>
          <Button
            variant="secondary"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('composition')
              setError(null)
              setFeedback(null)
            }}
          >
            Manage Sections
          </Button>
            </div>
          </section>
          <section aria-labelledby={`site-content-${tenantId}`}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-fg-subtle" id={`site-content-${tenantId}`}>Homepage content</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="secondary"
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
            variant="secondary"
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
            variant="secondary"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('gallery')
              setError(null)
              setFeedback(null)
            }}
          >
            {gallery ? 'Edit Gallery' : 'Add Gallery'}
          </Button>
          <Button
            variant="secondary"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('testimonials')
              setError(null)
              setFeedback(null)
            }}
          >
            {testimonials ? 'Edit Testimonials' : 'Add Testimonials'}
          </Button>
          <Button
            variant="secondary"
            disabled={Boolean(pending)}
            onClick={() => {
              setEditor('contact')
              setError(null)
              setFeedback(null)
            }}
          >
            {contact ? 'Edit Contact' : 'Add Contact'}
          </Button>
            </div>
          </section>
          <Card className="sticky bottom-4 z-10 flex flex-col gap-4 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-fg">Publishing</h2><p className="mt-1 text-sm text-fg-muted">{published ? 'Republish to send working changes live.' : 'Publish when the site is ready for visitors.'}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
          <Button
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
              disabled={Boolean(pending)}
              onClick={() => void run(
                'unpublish',
                () => unpublishSite(tenantId),
                'Unable to unpublish the website. Please try again.'
              )}
              variant="secondary"
            >
              {pending === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
            </Button>
          )}
            </div>
          </Card>
        </div>
      )}
      {error && <div className="mt-4"><StatusMessage tone="error">{error}</StatusMessage></div>}
      {feedback && <div className="mt-4"><StatusMessage tone="success">{feedback}</StatusMessage></div>}
    </div>
  )
}
