'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { isHeroSection, type HeroContent, type SiteDefinition, type SiteSection } from '@bakerrang/site-schema'
import { Badge, Button, Card, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { createSitePreviewToken, getSite, getSiteDomain, initializeSite, publishSite, unpublishSite, updateSectionContent, type SiteDomain } from '../../lib/site'
import { sitePreviewUrl } from '../../lib/sitePreview'
import { AboutEditor } from './AboutEditor'
import { BrandingEditor } from './BrandingEditor'
import { BusinessHoursEditor } from './BusinessHoursEditor'
import { BusinessProfileEditor } from './BusinessProfileEditor'
import { ContactEditor } from './ContactEditor'
import { CtaEditor } from './CtaEditor'
import { CustomCssEditor } from './CustomCssEditor'
import { FaqEditor } from './FaqEditor'
import { GalleryEditor } from './GalleryEditor'
import { LogosEditor } from './LogosEditor'
import { ProcessEditor } from './ProcessEditor'
import { StatsEditor } from './StatsEditor'
import { HeroEditor } from './HeroEditor'
import { HeaderEditor } from './HeaderEditor'
import { FooterEditor } from './FooterEditor'
import { BusinessHoursSectionEditor } from './BusinessHoursSectionEditor'
import { sectionDefinitions } from './sectionDefinitions'
import { PageSectionManager } from './PageSectionManager'
import { PagesManager } from './PagesManager'
import { ServicesEditor } from './ServicesEditor'
import { SocialProfilesEditor } from './SocialProfilesEditor'
import { SeoEditor } from './SeoEditor'
import { TestimonialsEditor } from './TestimonialsEditor'
import { ThemeEditor } from './ThemeEditor'
import { TemplatesEditor } from './TemplatesEditor'
import { RevisionHistoryEditor } from './RevisionHistoryEditor'
import { WebsiteEditorNavigation } from './WebsiteEditorNavigation'
import { WebsiteEditorCanvas } from './WebsiteEditorCanvas'
import { HeroDraftInspector } from './HeroDraftInspector'
import { useBusinessNavigationGuard } from './BusinessNavigationGuard'
import { parseWebsiteEditor, websiteEditorById, type WebsiteEditorId, type WebsitePaneId } from './websiteEditors'

export interface BusinessWebsiteProps { tenantId: string, autoLoad?: boolean }
type View = 'initial' | 'missing' | 'site'
type Operation = 'manage' | 'initialize' | 'preview' | 'publish' | 'unpublish' | 'saveHero'

const cloneSite = (definition: SiteDefinition) => structuredClone(definition)

function publicationStatus (site: SiteDefinition) {
  if (site.status === 'DRAFT') return { label: 'Draft', tone: 'warning' as const }
  if (site.hasUnpublishedChanges) return { label: 'Changes not published', tone: 'warning' as const }
  return { label: 'Published', tone: 'success' as const }
}

function publishedDate (timestamp: number | undefined) {
  if (!Number.isSafeInteger(timestamp) || (timestamp ?? -1) < 0) return null
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(timestamp)
}

function ActiveWebsiteEditor ({ editor, onBackToPages, onCancel, onDirtyChange, onEditSection, onPreviewPage, onRefresh, onSaved, onSelectSeoContext, pageId, sectionId, site, tenantId }: {
  editor: WebsiteEditorId
  onBackToPages: (pageId?: string) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onEditSection: (sectionId: string) => void
  onPreviewPage: (pageId: string) => void
  onRefresh: () => Promise<SiteDefinition>
  onSaved: (site: SiteDefinition, successMessage?: string, offerHomePreview?: boolean) => void
  onSelectSeoContext: (pageId?: string) => void
  pageId?: string
  sectionId?: string
  site: SiteDefinition
  tenantId: string
}) {
  if (editor === 'pages') return <PagesManager onDirtyChange={onDirtyChange} onEditPage={(id) => onBackToPages(id)} onPreviewPage={onPreviewPage} onSaved={onSaved} site={site} tenantId={tenantId} />
  if (editor === 'page') {
    if (!pageId) return <StatusMessage tone="error">Choose a page from Pages.</StatusMessage>
    const page = site.pages.find((candidate) => candidate.id === pageId)
    if (!page) return <StatusMessage tone="error">This page is no longer available. Return to Pages and choose another page.</StatusMessage>
    if (!sectionId) return <PageSectionManager onBack={onCancel} onEditSection={onEditSection} onPreview={() => onPreviewPage(pageId)} onRefresh={onRefresh} onSaved={(next) => onSaved(next)} pageId={pageId} site={site} tenantId={tenantId} />
    const section = page.sections.find((candidate) => candidate.id === sectionId)
    if (!section) return <PageSectionManager onBack={onCancel} onEditSection={onEditSection} onPreview={() => onPreviewPage(pageId)} onRefresh={onRefresh} onSaved={(next) => onSaved(next)} pageId={pageId} site={site} tenantId={tenantId} />
    const sectionEditor = sectionDefinitions[section.type].editor
    switch (sectionEditor) {
      case 'hero': return <HeroEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'about': return <AboutEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'process': return <ProcessEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'stats': return <StatsEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'cta': return <CtaEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'logos': return <LogosEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'services': return <ServicesEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'gallery': return <GalleryEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'testimonials': return <TestimonialsEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'faq': return <FaqEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'businessHoursSection': return <BusinessHoursSectionEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'contact': return <ContactEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
    }
  }
  switch (editor) {
    case 'branding': return <BrandingEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'theme': return <ThemeEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'businessProfile': return <BusinessProfileEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'businessHours': return <BusinessHoursEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'socialProfiles': return <SocialProfilesEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'templates': return <TemplatesEditor onSaved={onSaved} tenantId={tenantId} />
    case 'revisions': return <RevisionHistoryEditor onSaved={onSaved} tenantId={tenantId} />
    case 'header': return <HeaderEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onPreview={() => onPreviewPage('home')} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'footer': return <FooterEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onPreview={() => onPreviewPage('home')} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'seo': return <SeoEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onPreviewPage={onPreviewPage} onSaved={onSaved} onSelectContext={onSelectSeoContext} pageId={pageId} site={site} tenantId={tenantId} />
    case 'customCss': return <CustomCssEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
  }
}

function WebsiteOverview ({ domain, onManagePages, onUnpublish, pending, site, tenantId }: {
  domain: SiteDomain | null
  onManagePages: () => void
  onUnpublish: () => void
  pending: Operation | null
  site: SiteDefinition
  tenantId: string
}) {
  const status = publicationStatus(site)
  const sectionCount = site.pages.reduce((count, page) => count + page.sections.length, 0)
  const lastPublished = publishedDate(site.lastPublishedAt)
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-fg">Website Overview</h2>
        <p className="mt-1 text-sm leading-6 text-fg-muted">Review what is configured and whether the public site is up to date.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-fg">Publication</h3>
          <Badge className="mt-3" tone={status.tone}>{status.label}</Badge>
          {lastPublished && <p className="mt-3 text-sm text-fg-muted">Last published {lastPublished}</p>}
          {site.status === 'PUBLISHED' && <Button className="mt-5" disabled={Boolean(pending)} onClick={onUnpublish} size="sm" variant="secondary">{pending === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}</Button>}
        </Card>
        <Card className="min-w-0 p-5">
          <h3 className="text-sm font-semibold text-fg">Pages</h3>
          <p className="mt-3 text-sm text-fg-muted">{site.pages.length} {site.pages.length === 1 ? 'page' : 'pages'} · {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}</p>
          <Button className="mt-5" onClick={onManagePages} size="sm">Manage pages</Button>
        </Card>
      </div>
      {domain?.status === 'ACTIVE' && (
        <Card className="min-w-0 p-5">
          <h3 className="text-sm font-semibold text-fg">Active custom domain</h3>
          <p className="mt-2 break-all text-sm text-fg-muted">{domain.hostname}</p>
          <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-info-fg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/businesses/${encodeURIComponent(tenantId)}/domain`}>Manage domain →</Link>
        </Card>
      )}
    </div>
  )
}

function DeferredSectionInspector ({ onOpenExistingControls, section }: { onOpenExistingControls: () => void, section: SiteSection }) {
  return <section aria-label={`${sectionDefinitions[section.type].label} properties`} className="border-t border-border pt-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-fg-subtle">{sectionDefinitions[section.type].label}</p><h2 className="mt-2 text-base font-semibold tracking-tight text-fg">Editing coming soon</h2><p className="mt-2 text-sm leading-6 text-fg-muted">This section is visible in the live canvas. Its existing controls remain available while its draft-native inspector is prepared.</p><Button className="mt-4" onClick={onOpenExistingControls} size="sm" variant="secondary">Open existing controls</Button></section>
}

export function BusinessWebsite ({ autoLoad = false, tenantId }: BusinessWebsiteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryKey = searchParams.toString()
  const queryEditor = parseWebsiteEditor(searchParams.get('editor'))
  const querySectionId = searchParams.get('sectionId') ?? undefined
  const queryPageId = searchParams.get('pageId') ?? undefined
  const [view, setView] = useState<View>('initial')
  const [site, setSite] = useState<SiteDefinition | null>(null)
  const [draft, setDraft] = useState<SiteDefinition | null>(null)
  const [domain, setDomain] = useState<SiteDomain | null>(null)
  const [pending, setPending] = useState<Operation | null>(autoLoad ? 'manage' : null)
  const [error, setError] = useState<string | null>(null)
  const [editorSelection, setEditorSelection] = useState<{ fromQueryKey: string, toQueryKey: string, editor: WebsiteEditorId | null }>({ fromQueryKey: queryKey, toQueryKey: queryKey, editor: queryEditor })
  const [feedback, setFeedback] = useState<string | null>(null)
  const [offerHomePreview, setOfferHomePreview] = useState(false)
  const [previewFallback, setPreviewFallback] = useState<string | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const [editorSessionRevision, setEditorSessionRevision] = useState(0)
  const [pendingPane, setPendingPane] = useState<{ editor: WebsitePaneId, pageId?: string, sectionId?: string } | null>(null)
  const [canvasSelection, setCanvasSelection] = useState<{ pageId?: string, sectionId?: string }>({ pageId: queryPageId, sectionId: querySectionId })
  const [showSectionManager, setShowSectionManager] = useState(false)
  const [showLegacySectionInspector, setShowLegacySectionInspector] = useState(false)
  useBusinessNavigationGuard(editorDirty)

  const editor = queryKey === editorSelection.fromQueryKey || queryKey === editorSelection.toQueryKey
    ? editorSelection.editor
    : queryEditor
  const handleDirtyChange = useCallback((dirty: boolean) => setEditorDirty(dirty), [])
  const acceptCanonicalSite = useCallback((definition: SiteDefinition) => {
    setSite(definition)
    setDraft(cloneSite(definition))
    setEditorDirty(false)
  }, [])
  useEffect(() => {
    if (!editorDirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [editorDirty])
  useEffect(() => {
    let cancelled = false
    void getSiteDomain(tenantId).then((value) => { if (!cancelled) setDomain(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [tenantId])
  useEffect(() => {
    if (!autoLoad) return
    let cancelled = false
    void getSite(tenantId).then((definition) => {
      if (cancelled) return
      acceptCanonicalSite(definition); setView('site')
    }).catch((caught: unknown) => {
      if (cancelled) return
      if (caught instanceof ApiError && caught.status === 404) setView('missing')
      else setError('Unable to load the website. Please try again.')
    }).finally(() => { if (!cancelled) setPending(null) })
    return () => { cancelled = true }
  }, [acceptCanonicalSite, autoLoad, tenantId])

  const navigateToEditor = (next: WebsitePaneId, pageId?: string, sectionId?: string) => {
    const nextEditor = next === 'overview' ? null : next
    setError(null); setFeedback(null); setOfferHomePreview(false)
    const params = new URLSearchParams(searchParams.toString())
    if (nextEditor) params.set('editor', nextEditor)
    else params.delete('editor')
    if ((nextEditor === 'page' || nextEditor === 'seo') && pageId) params.set('pageId', pageId)
    else params.delete('pageId')
    if (nextEditor === 'page' && sectionId) params.set('sectionId', sectionId)
    else params.delete('sectionId')
    const query = params.toString()
    setCanvasSelection({ pageId, sectionId })
    setShowSectionManager(nextEditor === 'page' && Boolean(pageId) && !sectionId)
    setShowLegacySectionInspector(false)
    setEditorSelection({ fromQueryKey: queryKey, toQueryKey: query, editor: nextEditor })
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const selectEditor = (next: WebsitePaneId) => {
    const current: WebsitePaneId = editor ?? 'overview'
    if (next === current && !(next === 'page' && querySectionId)) return
    if (editorDirty) { setPendingPane({ editor: next }); return }
    navigateToEditor(next)
  }
  const selectPage = (pageId: string, sectionId?: string) => {
    const currentDraft = draft ?? site
    const currentPage = currentDraft?.pages.find((page) => page.id === canvasSelection.pageId) ?? currentDraft?.pages.find((page) => page.id === queryPageId) ?? currentDraft?.pages.find((page) => page.id === 'home') ?? currentDraft?.pages[0]
    const currentSectionId = showSectionManager ? undefined : canvasSelection.sectionId ?? querySectionId ?? currentPage?.sections.find((section) => section.type === 'hero')?.id ?? currentPage?.sections[0]?.id
    if ((!editor || editor === 'page') && currentPage?.id === pageId && currentSectionId === sectionId) return
    if (editorDirty) { setPendingPane({ editor: 'page', pageId, sectionId }); return }
    navigateToEditor('page', pageId, sectionId)
  }
  const selectSeoContext = (pageId?: string) => {
    if (editorDirty) { setPendingPane({ editor: 'seo', pageId }); return }
    navigateToEditor('seo', pageId)
  }
  const run = async (operation: Operation, action: () => Promise<SiteDefinition>, message: string) => {
    if (pending) return
    setPending(operation); setError(null); setFeedback(null); setOfferHomePreview(false)
    try { acceptCanonicalSite(await action()); setView('site') } catch { setError(message) } finally { setPending(null) }
  }
  const handleManage = async () => {
    if (pending) return
    setPending('manage'); setError(null)
    try { acceptCanonicalSite(await getSite(tenantId)); setView('site') } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setView('missing')
      else setError('Unable to load the website. Please try again.')
    } finally { setPending(null) }
  }
  const handleInitialize = async () => {
    if (pending) return
    setPending('initialize'); setError(null)
    try { acceptCanonicalSite(await initializeSite(tenantId)); setView('site') } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        try { acceptCanonicalSite(await getSite(tenantId)); setView('site'); return } catch { setError('Unable to load the existing website. Please try again.'); return }
      }
      setError('Unable to initialize the website. Please try again.')
    } finally { setPending(null) }
  }
  const handlePreview = (pageId = queryPageId ?? 'home') => {
    if (pending || editorDirty) return
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null
    setPending('preview'); setError(null); setFeedback(null); setOfferHomePreview(false); setPreviewFallback(null)
    void createSitePreviewToken(tenantId).then(({ token }) => {
      const url = sitePreviewUrl(tenantId, token, pageId)
      if (previewWindow) previewWindow.location.href = url
      else setPreviewFallback(url)
    }).catch(() => { previewWindow?.close(); setError('Unable to open the website preview. Please try again.') }).finally(() => setPending(null))
  }

  if (view === 'initial') {
    if (autoLoad) return <StatusMessage>Loading website…</StatusMessage>
    return <div><Button disabled={Boolean(pending)} onClick={() => void handleManage()} size="sm">{pending === 'manage' ? 'Loading…' : 'Manage Website'}</Button>{error && <div className="mt-3"><StatusMessage tone="error">{error}</StatusMessage></div>}</div>
  }
  if (view === 'missing') {
    return <Card className="p-6 text-left"><h2 className="text-lg font-semibold text-fg">Initialize this website</h2><p className="mt-2 text-sm leading-6 text-fg-muted">Create the working site before adding content or publishing.</p><Button className="mt-5" disabled={Boolean(pending)} onClick={() => void handleInitialize()}>{pending === 'initialize' ? 'Initializing…' : 'Initialize Website'}</Button>{error && <div className="mt-3"><StatusMessage tone="error">{error}</StatusMessage></div>}</Card>
  }
  if (!site) return <StatusMessage tone="error">Unable to load the website. Please try again.</StatusMessage>

  const activePane: WebsitePaneId = editor === 'page' ? 'pages' : editor ?? 'overview'
  const handleEditorSaved = (definition: SiteDefinition, successMessage?: string, nextOfferHomePreview = false) => {
    acceptCanonicalSite(definition); setError(null); setEditorSessionRevision((revision) => revision + 1)
    setOfferHomePreview(nextOfferHomePreview)
    setFeedback(successMessage ?? (definition.status === 'PUBLISHED' ? 'Saved. Republish to update the public site.' : 'Changes saved.'))
  }
  const publish = () => {
    if (editorDirty) { setError('Save changes before publishing.'); return }
    void run('publish', () => publishSite(tenantId), 'Unable to publish the website. Please try again.')
  }
  const unpublish = () => void run('unpublish', () => unpublishSite(tenantId), 'Unable to unpublish the website. Please try again.')
  const refreshWorkingSite = async () => {
    const definition = await getSite(tenantId)
    acceptCanonicalSite(definition); setView('site')
    return definition
  }

  const draftSite = draft ?? site
  const activePage = draftSite.pages.find((page) => page.id === canvasSelection.pageId) ?? draftSite.pages.find((page) => page.id === queryPageId) ?? draftSite.pages.find((page) => page.id === 'home') ?? draftSite.pages[0]
  if (!activePage) return <StatusMessage tone="error">This website has no pages to edit.</StatusMessage>
  const selectedSectionId = showSectionManager ? undefined : canvasSelection.sectionId ?? querySectionId ?? activePage.sections.find((section) => section.type === 'hero')?.id ?? activePage.sections[0]?.id
  const selectedSection = activePage.sections.find((section) => section.id === selectedSectionId)
  const selectedHero = selectedSection && isHeroSection(selectedSection) ? selectedSection : null
  const changeHero = (content: HeroContent) => {
    if (!selectedHero) return
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedHero.id && isHeroSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const saveHero = async () => {
    if (!selectedHero || pending) return
    const title = selectedHero.content.title.trim()
    const subtitle = selectedHero.content.subtitle?.trim() ?? ''
    const ctaLabel = selectedHero.content.ctaLabel?.trim() ?? ''
    if (!title) { setError('Headline is required.'); return }
    setPending('saveHero'); setError(null); setFeedback(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedHero.id, { title, subtitle, ...(ctaLabel ? { ctaLabel } : {}) })
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
      setFeedback('Hero changes saved to the working site.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save the Hero. Please try again.')
    } finally { setPending(null) }
  }
  const selectCanvasPage = (pageId: string) => {
    const nextPage = draftSite.pages.find((page) => page.id === pageId)
    selectPage(pageId, nextPage?.sections.find((section) => section.type === 'hero')?.id ?? nextPage?.sections[0]?.id)
  }
  const selectCanvasSection = (sectionId: string) => {
    const owner = draftSite.pages.find((page) => page.sections.some((section) => section.id === sectionId))
    if (owner) selectPage(owner.id, sectionId)
  }
  const showHeroInspector = Boolean(selectedHero && (!editor || editor === 'page'))
  const showDeferredSectionInspector = Boolean(editor === 'page' && selectedSection && !selectedHero && !showLegacySectionInspector)
  // Transitional boundary: non-Hero editors continue to save through their existing contracts.
  const legacyInspector = editor && !showHeroInspector && !showDeferredSectionInspector ? <ActiveWebsiteEditor editor={editor} key={`${editor}:${activePage.id}:${selectedSectionId ?? 'manager'}:${editorSessionRevision}`} onBackToPages={(pageId) => typeof pageId === 'string' ? selectPage(pageId) : selectEditor('pages')} onCancel={() => selectEditor('overview')} onDirtyChange={handleDirtyChange} onEditSection={(sectionId) => selectCanvasSection(sectionId)} onPreviewPage={handlePreview} onRefresh={refreshWorkingSite} onSaved={handleEditorSaved} onSelectSeoContext={selectSeoContext} pageId={editor === 'page' || editor === 'seo' ? activePage.id : undefined} sectionId={editor === 'page' ? selectedSectionId : undefined} site={site} tenantId={tenantId} /> : null
  const inspector = <>{showHeroInspector && selectedHero ? <HeroDraftInspector hero={selectedHero} onChange={changeHero} saving={pending === 'saveHero'} /> : showDeferredSectionInspector && selectedSection ? <DeferredSectionInspector onOpenExistingControls={() => setShowLegacySectionInspector(true)} section={selectedSection} /> : legacyInspector ?? <WebsiteOverview domain={domain} onManagePages={() => selectEditor('pages')} onUnpublish={unpublish} pending={pending} site={site} tenantId={tenantId} />}<details className="mt-6 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold text-fg">More site settings</summary><div className="mt-3"><WebsiteEditorNavigation active={activePane} onSelect={selectEditor} /></div></details></>

  return (
    <div className="w-full min-w-0">
      {(error || previewFallback || feedback) && <div className="mb-5 space-y-3" aria-live="polite">{error && <StatusMessage tone="error">{error}</StatusMessage>}{previewFallback && <StatusMessage>Your browser blocked the preview tab. <a className="font-semibold underline underline-offset-2" href={previewFallback} rel="noopener noreferrer" target="_blank">Open preview</a></StatusMessage>}{feedback && <StatusMessage tone="success">{feedback}</StatusMessage>}{offerHomePreview && <Button onClick={() => handlePreview('home')} variant="secondary">Preview Home</Button>}</div>}
      <WebsiteEditorCanvas canSave={Boolean(selectedHero)} canonical={site} dirty={editorDirty} inspector={inspector} onManageSections={() => selectPage(activePage.id)} onOpenPreview={() => handlePreview(activePage.id)} onPageSelected={selectCanvasPage} onPublish={publish} onSave={() => void saveHero()} onSectionSelected={selectCanvasSection} onSiteTool={selectEditor} page={activePage} saving={Boolean(pending)} selectedSectionId={selectedSectionId} site={draftSite} />
      <ConfirmDialog cancelLabel="Keep editing" confirmLabel="Discard changes" description={`Your changes in ${editor ? websiteEditorById.get(editor)?.label ?? 'this editor' : 'this editor'} haven't been saved.`} onCancel={() => setPendingPane(null)} onConfirm={() => { const destination = pendingPane; setPendingPane(null); setDraft(cloneSite(site)); setEditorDirty(false); if (destination) navigateToEditor(destination.editor, destination.pageId, destination.sectionId) }} open={pendingPane !== null} title="Discard unsaved changes?" />
    </div>
  )
}
