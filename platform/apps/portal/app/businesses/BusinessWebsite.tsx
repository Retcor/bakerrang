'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { isAboutSection, isContactSection, isCtaSection, isFaqSection, isGallerySection, isHeroSection, isLogosSection, isServicesSection, isTestimonialsSection, type AboutContent, type ContactContent, type CtaContent, type FaqContent, type GalleryContent, type HeroContent, type LogosContent, type SectionType, type ServicesContent, type SiteDefinition, type SiteSection, type TestimonialsContent } from '@bakerrang/site-schema'
import { Badge, Button, Card, ConfirmDialog, StatusMessage } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import type { MediaItem } from '../../lib/media'
import { addSection, createSitePreviewToken, getSite, getSiteDomain, initializeSite, publishSite, setSectionVisibility, unpublishSite, updateSectionContent, type SiteDomain } from '../../lib/site'
import { sitePreviewUrl } from '../../lib/sitePreview'
import { BrandingEditor } from './BrandingEditor'
import { BusinessHoursEditor } from './BusinessHoursEditor'
import { BusinessProfileEditor } from './BusinessProfileEditor'
import { CustomCssEditor } from './CustomCssEditor'
import { ProcessEditor } from './ProcessEditor'
import { StatsEditor } from './StatsEditor'
import { HeroEditor } from './HeroEditor'
import { HeaderEditor } from './HeaderEditor'
import { FooterEditor } from './FooterEditor'
import { BusinessHoursSectionEditor } from './BusinessHoursSectionEditor'
import { sectionDefinitions } from './sectionDefinitions'
import { AddSectionPanel } from './AddSectionPanel'
import { PageSectionManager } from './PageSectionManager'
import { PagesManager } from './PagesManager'
import { SocialProfilesEditor } from './SocialProfilesEditor'
import { SeoEditor } from './SeoEditor'
import { ThemeEditor } from './ThemeEditor'
import { TemplatesEditor } from './TemplatesEditor'
import { RevisionHistoryEditor } from './RevisionHistoryEditor'
import { WebsiteEditorCanvas } from './WebsiteEditorCanvas'
import { MoreSettingsPanel } from './MoreSettingsPanel'
import { SiteToolsPanel } from './SiteToolsPanel'
import { type ActiveEditorController } from './WebsiteEditorShell'
import { HeroDraftInspector } from './HeroDraftInspector'
import { ServicesDraftInspector, servicesContentError } from './ServicesDraftInspector'
import { TestimonialsDraftInspector, testimonialsContentError } from './TestimonialsDraftInspector'
import { FaqDraftInspector, faqContentError } from './FaqDraftInspector'
import { CtaDraftInspector, ctaContentError } from './CtaDraftInspector'
import { ContactDraftInspector, contactContentError } from './ContactDraftInspector'
import { GalleryDraftInspector, galleryContentError } from './GalleryDraftInspector'
import { LogosDraftInspector, logosContentError } from './LogosDraftInspector'
import { AboutDraftInspector, aboutContentError } from './AboutDraftInspector'
import { MediaPicker } from './MediaPicker'
import { useBusinessNavigationGuard } from './BusinessNavigationGuard'
import { parseWebsiteEditor, websiteEditorById, type WebsiteEditorId, type WebsiteLauncherId, type WebsitePaneId } from './websiteEditors'

export interface BusinessWebsiteProps { tenantId: string, autoLoad?: boolean }
type View = 'initial' | 'missing' | 'site'
type Operation = 'manage' | 'initialize' | 'preview' | 'publish' | 'unpublish' | 'saveHero' | 'saveAbout' | 'saveServices' | 'saveGallery' | 'saveLogos' | 'saveTestimonials' | 'saveFaq' | 'saveCta' | 'saveContact' | 'visibility'

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

function ActiveWebsiteEditor ({ editor, onBackToPages, onCancel, onControllerChange, onDirtyChange, onEditSection, onLivePreview, onPreviewPage, onRefresh, onSaved, onSelectSeoContext, pageId, sectionId, site, tenantId }: {
  editor: WebsiteEditorId
  onBackToPages: (pageId?: string) => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange: (dirty: boolean) => void
  onEditSection: (sectionId: string) => void
  onLivePreview?: (patch: Partial<Pick<SiteDefinition, 'theme' | 'header' | 'footer'>>) => void
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
      case 'process': return <ProcessEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'stats': return <StatsEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
      case 'businessHoursSection': return <BusinessHoursSectionEditor onCancel={onBackToPages} onDirtyChange={onDirtyChange} onSaved={onSaved} pageId={pageId} sectionId={sectionId} site={site} tenantId={tenantId} />
    }
  }
  switch (editor) {
    case 'branding': return <BrandingEditor chrome="rail" onBack={onCancel} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'theme': return <ThemeEditor chrome="rail" onBack={onCancel} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onLivePreview={onLivePreview} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'businessProfile': return <BusinessProfileEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'businessHours': return <BusinessHoursEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'socialProfiles': return <SocialProfilesEditor onCancel={onCancel} onDirtyChange={onDirtyChange} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'header': return <HeaderEditor chrome="rail" onBack={onCancel} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onLivePreview={onLivePreview} onPreview={() => onPreviewPage('home')} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'footer': return <FooterEditor chrome="rail" onBack={onCancel} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onLivePreview={onLivePreview} onPreview={() => onPreviewPage('home')} onSaved={onSaved} site={site} tenantId={tenantId} />
    case 'seo': return <SeoEditor chrome="rail" onBack={onCancel} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onPreviewPage={onPreviewPage} onSaved={onSaved} onSelectContext={onSelectSeoContext} pageId={pageId} site={site} tenantId={tenantId} />
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
  const [offerHomePreview, setOfferHomePreview] = useState(false)
  const [previewFallback, setPreviewFallback] = useState<string | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const [toolController, setToolController] = useState<ActiveEditorController | null>(null)
  const [editorSessionRevision, setEditorSessionRevision] = useState(0)
  const [pendingPane, setPendingPane] = useState<{ editor: WebsitePaneId, pageId?: string, sectionId?: string } | null>(null)
  const [canvasSelection, setCanvasSelection] = useState<{ pageId?: string, sectionId?: string }>({ pageId: queryPageId, sectionId: querySectionId })
  const [showSectionManager, setShowSectionManager] = useState(false)
  const [showLegacySectionInspector, setShowLegacySectionInspector] = useState(false)
  const [addingSection, setAddingSection] = useState(false)
  const [pendingAddType, setPendingAddType] = useState<SectionType | null>(null)
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false)
  const [siteToolsMenuOpen, setSiteToolsMenuOpen] = useState(false)
  const [openSiteToolsAfterDiscard, setOpenSiteToolsAfterDiscard] = useState(false)
  const [mediaPickerSectionId, setMediaPickerSectionId] = useState<string | null>(null)
  useBusinessNavigationGuard(editorDirty)

  const editor = queryKey === editorSelection.fromQueryKey || queryKey === editorSelection.toQueryKey
    ? editorSelection.editor
    : queryEditor
  const activeSiteTool = editor === 'theme' || editor === 'branding' || editor === 'seo' || editor === 'header' || editor === 'footer'
    ? editor
    : null
  const handleDirtyChange = useCallback((dirty: boolean) => setEditorDirty(dirty), [])
  const applyLivePreview = useCallback((patch: Partial<Pick<SiteDefinition, 'theme' | 'header' | 'footer'>>) => {
    setDraft((current) => current ? { ...current, ...patch } : current)
  }, [])
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
    setError(null); setOfferHomePreview(false)
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
    setMediaPickerSectionId(null)
    setMoreSettingsOpen(false)
    setSiteToolsMenuOpen(false)
    setToolController(null)
    setEditorSelection({ fromQueryKey: queryKey, toQueryKey: query, editor: nextEditor })
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const selectEditor = (next: WebsitePaneId) => {
    const current: WebsitePaneId = editor ?? 'overview'
    if (next === current && !(next === 'page' && querySectionId)) return
    if (editorDirty) { setPendingPane({ editor: next }); return }
    navigateToEditor(next)
  }
  const selectSiteTool = (tool: WebsiteLauncherId) => {
    if (tool === 'moreSettings') { setSiteToolsMenuOpen(false); setMoreSettingsOpen(true); return }
    selectEditor(tool)
  }
  const openSiteTools = () => {
    setError(null); setOfferHomePreview(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('editor')
    params.delete('pageId')
    params.delete('sectionId')
    const query = params.toString()
    setMoreSettingsOpen(false)
    setToolController(null)
    setEditorSelection({ fromQueryKey: queryKey, toQueryKey: query, editor: null })
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    setSiteToolsMenuOpen(true)
  }
  const backToSiteTools = () => {
    if (editorDirty) { setOpenSiteToolsAfterDiscard(true); setPendingPane({ editor: 'overview' }); return }
    openSiteTools()
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
    setPending(operation); setError(null); setOfferHomePreview(false)
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
    setPending('preview'); setError(null); setOfferHomePreview(false); setPreviewFallback(null)
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

  const handleEditorSaved = (definition: SiteDefinition, _successMessage?: string, nextOfferHomePreview = false) => {
    acceptCanonicalSite(definition); setError(null); setEditorSessionRevision((revision) => revision + 1)
    setOfferHomePreview(nextOfferHomePreview)
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
  const selectedAboutSection = selectedSection && isAboutSection(selectedSection) ? selectedSection : null
  const selectedServicesSection = selectedSection && isServicesSection(selectedSection) ? selectedSection : null
  const selectedGallerySection = selectedSection && isGallerySection(selectedSection) ? selectedSection : null
  const selectedLogosSection = selectedSection && isLogosSection(selectedSection) ? selectedSection : null
  const selectedTestimonialsSection = selectedSection && isTestimonialsSection(selectedSection) ? selectedSection : null
  const selectedFaqSection = selectedSection && isFaqSection(selectedSection) ? selectedSection : null
  const selectedCtaSection = selectedSection && isCtaSection(selectedSection) ? selectedSection : null
  const selectedContactSection = selectedSection && isContactSection(selectedSection) ? selectedSection : null
  const fullScreenToolId = editor === 'templates' || editor === 'revisions' ? editor : null
  const addAfterSectionId = selectedSectionId && activePage.sections.some((section) => section.id === selectedSectionId) ? selectedSectionId : undefined
  const closeAddSection = () => {
    setAddingSection(false); setPendingAddType(null); setAddError(null)
  }
  const performAddSection = async (type: SectionType) => {
    if (addBusy || pending) return
    setAddBusy(true); setAddError(null); setError(null)
    try {
      const result = await addSection(tenantId, activePage.id, type, addAfterSectionId)
      acceptCanonicalSite(result.site)
      setAddingSection(false); setPendingAddType(null)
      // This follows the same editor URL/selection path as canvas selection after
      // accepting the canonical working-site response.
      navigateToEditor('page', activePage.id, result.sectionId)
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        setAddError(caught.message || 'The page changed. Review the current sections and try again.')
      } else setAddError('Unable to add this section. Please try again.')
    } finally { setAddBusy(false) }
  }
  const chooseAddSection = (type: SectionType) => {
    if (addBusy || pending) return
    if (editorDirty) { setPendingAddType(type); return }
    void performAddSection(type)
  }
  const toggleVisibility = (section: SiteSection) => {
    if (section.type === 'hero' || editorDirty || pending || addBusy || pendingAddType) return
    setPending('visibility'); setError(null)
    void setSectionVisibility(tenantId, activePage.id, section.id, !section.hidden)
      .then((definition) => {
        acceptCanonicalSite(definition)
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) setError(caught.message)
        else setError('Unable to update section visibility. Please try again.')
      })
      .finally(() => setPending(null))
  }
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
    setPending('saveHero'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedHero.id, { title, subtitle, ...(ctaLabel ? { ctaLabel } : {}) })
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save the Hero. Please try again.')
    } finally { setPending(null) }
  }
  const changeAbout = (content: AboutContent) => {
    if (!selectedAboutSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedAboutSection.id && isAboutSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const selectAboutMedia = (media: MediaItem) => {
    if (!selectedAboutSection || selectedAboutSection.content.imageMediaId === media.id) return
    changeAbout({
      ...selectedAboutSection.content,
      imageMediaId: media.id,
      imageAlt: '',
      imageSrc: media.src,
      imageWidth: media.width,
      imageHeight: media.height
    })
  }
  const saveAbout = async () => {
    if (!selectedAboutSection || pending) return
    const validationError = aboutContentError(selectedAboutSection.content)
    if (validationError) { setError(validationError); return }
    const content = selectedAboutSection.content
    const eyebrow = content.eyebrow?.trim() ?? ''
    const heading = content.heading.trim()
    const body = content.body.trim()
    const imageAlt = content.imageAlt?.trim() ?? ''
    const configured = content.buttonLabel !== undefined || content.action !== undefined
    const payload = {
      ...(eyebrow ? { eyebrow } : {}),
      heading,
      body,
      ...(content.imageMediaId ? { imageMediaId: content.imageMediaId, imageAlt } : {}),
      ...(content.imageMediaId && content.imagePosition === 'right' ? { imagePosition: 'right' as const } : {}),
      ...(configured
        ? {
            buttonLabel: content.buttonLabel!.trim(),
            action: {
              type: content.action!.type,
              value: content.action!.value.trim()
            }
          }
        : {})
    }
    setPending('saveAbout'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedAboutSection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save About. Please try again.')
    } finally { setPending(null) }
  }
  const changeServices = (content: ServicesContent) => {
    if (!selectedServicesSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedServicesSection.id && isServicesSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const saveServices = async () => {
    if (!selectedServicesSection || pending) return
    const validationError = servicesContentError(selectedServicesSection.content)
    if (validationError) { setError(validationError); return }
    const canonicalPage = site.pages.find((page) => page.id === activePage.id)
    const canonicalSection = canonicalPage?.sections.find((section) => section.id === selectedServicesSection.id)
    const canonicalIds = new Set(canonicalSection && isServicesSection(canonicalSection) ? canonicalSection.content.items.map((item) => item.id) : [])
    const payload = {
      title: selectedServicesSection.content.title.trim(),
      items: selectedServicesSection.content.items.map((item) => ({
        ...(canonicalIds.has(item.id) ? { id: item.id } : {}),
        name: item.name.trim(),
        description: item.description ?? ''
      }))
    }
    setPending('saveServices'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedServicesSection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Services. Please try again.')
    } finally { setPending(null) }
  }
  const changeGallery = (content: GalleryContent) => {
    if (!selectedGallerySection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedGallerySection.id && isGallerySection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const selectGalleryMedia = (media: MediaItem) => {
    if (!selectedGallerySection || selectedGallerySection.content.items.length >= 20) return
    if (selectedGallerySection.content.items.some((item) => item.mediaId === media.id)) return
    changeGallery({
      ...selectedGallerySection.content,
      items: [...selectedGallerySection.content.items, {
        id: crypto.randomUUID(),
        mediaId: media.id,
        altText: '',
        src: media.src,
        width: media.width,
        height: media.height
      }]
    })
  }
  const saveGallery = async () => {
    if (!selectedGallerySection || pending) return
    const validationError = galleryContentError(selectedGallerySection.content)
    if (validationError) { setError(validationError); return }
    const canonicalPage = site.pages.find((page) => page.id === activePage.id)
    const canonicalSection = canonicalPage?.sections.find((section) => section.id === selectedGallerySection.id)
    const canonicalIds = new Set(canonicalSection && isGallerySection(canonicalSection) ? canonicalSection.content.items.map((item) => item.id) : [])
    const payload = {
      title: selectedGallerySection.content.title.trim(),
      items: selectedGallerySection.content.items.map((item) => ({
        ...(canonicalIds.has(item.id) ? { id: item.id } : {}),
        mediaId: item.mediaId,
        altText: item.altText.trim()
      }))
    }
    setPending('saveGallery'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedGallerySection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.message) setError(caught.message)
      else setError('Unable to save Gallery. Please try again.')
    } finally { setPending(null) }
  }
  const changeLogos = (content: LogosContent) => {
    if (!selectedLogosSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedLogosSection.id && isLogosSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const selectLogosMedia = (media: MediaItem) => {
    if (!selectedLogosSection || selectedLogosSection.content.items.length >= 24) return
    if (selectedLogosSection.content.items.some((item) => item.mediaId === media.id)) return
    changeLogos({
      ...selectedLogosSection.content,
      items: [...selectedLogosSection.content.items, {
        id: crypto.randomUUID(),
        mediaId: media.id,
        altText: '',
        src: media.src,
        width: media.width,
        height: media.height
      }]
    })
  }
  const saveLogos = async () => {
    if (!selectedLogosSection || pending) return
    const validationError = logosContentError(selectedLogosSection.content)
    if (validationError) { setError(validationError); return }
    const canonicalPage = site.pages.find((page) => page.id === activePage.id)
    const canonicalSection = canonicalPage?.sections.find((section) => section.id === selectedLogosSection.id)
    const canonicalIds = new Set(canonicalSection && isLogosSection(canonicalSection) ? canonicalSection.content.items.map((item) => item.id) : [])
    const heading = selectedLogosSection.content.heading?.trim() ?? ''
    const payload = {
      ...(heading ? { heading } : {}),
      items: selectedLogosSection.content.items.map((item) => ({
        ...(canonicalIds.has(item.id) ? { id: item.id } : {}),
        mediaId: item.mediaId,
        altText: item.altText.trim()
      }))
    }
    setPending('saveLogos'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedLogosSection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Logos. Please try again.')
    } finally { setPending(null) }
  }
  const changeTestimonials = (content: TestimonialsContent) => {
    if (!selectedTestimonialsSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedTestimonialsSection.id && isTestimonialsSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const saveTestimonials = async () => {
    if (!selectedTestimonialsSection || pending) return
    const validationError = testimonialsContentError(selectedTestimonialsSection.content)
    if (validationError) { setError(validationError); return }
    const canonicalPage = site.pages.find((page) => page.id === activePage.id)
    const canonicalSection = canonicalPage?.sections.find((section) => section.id === selectedTestimonialsSection.id)
    const canonicalIds = new Set(canonicalSection && isTestimonialsSection(canonicalSection) ? canonicalSection.content.items.map((item) => item.id) : [])
    const payload = {
      title: selectedTestimonialsSection.content.title.trim(),
      items: selectedTestimonialsSection.content.items.map((item) => ({
        ...(canonicalIds.has(item.id) ? { id: item.id } : {}),
        customerName: item.customerName.trim(),
        quote: item.quote.trim()
      }))
    }
    setPending('saveTestimonials'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedTestimonialsSection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Testimonials. Please try again.')
    } finally { setPending(null) }
  }
  const changeFaq = (content: FaqContent) => {
    if (!selectedFaqSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedFaqSection.id && isFaqSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const saveFaq = async () => {
    if (!selectedFaqSection || pending) return
    const validationError = faqContentError(selectedFaqSection.content)
    if (validationError) { setError(validationError); return }
    const canonicalPage = site.pages.find((page) => page.id === activePage.id)
    const canonicalSection = canonicalPage?.sections.find((section) => section.id === selectedFaqSection.id)
    const canonicalIds = new Set(canonicalSection && isFaqSection(canonicalSection) ? canonicalSection.content.items.map((item) => item.id) : [])
    const intro = selectedFaqSection.content.intro?.trim() ?? ''
    const payload = {
      heading: selectedFaqSection.content.heading.trim(),
      ...(intro ? { intro } : {}),
      items: selectedFaqSection.content.items.map((item) => ({
        ...(canonicalIds.has(item.id) ? { id: item.id } : {}),
        question: item.question.trim(),
        answer: item.answer.trim()
      }))
    }
    setPending('saveFaq'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedFaqSection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save FAQ. Please try again.')
    } finally { setPending(null) }
  }
  const changeCta = (content: CtaContent) => {
    if (!selectedCtaSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedCtaSection.id && isCtaSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const saveCta = async () => {
    if (!selectedCtaSection || pending) return
    const validationError = ctaContentError(selectedCtaSection.content)
    if (validationError) { setError(validationError); return }
    const heading = selectedCtaSection.content.heading.trim()
    const body = selectedCtaSection.content.body?.trim() ?? ''
    const configured = selectedCtaSection.content.buttonLabel !== undefined || selectedCtaSection.content.action !== undefined
    const payload = configured
      ? {
          heading,
          ...(body ? { body } : {}),
          buttonLabel: selectedCtaSection.content.buttonLabel!.trim(),
          action: {
            type: selectedCtaSection.content.action!.type,
            value: selectedCtaSection.content.action!.value.trim()
          }
        }
      : { heading, ...(body ? { body } : {}) }
    setPending('saveCta'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedCtaSection.id, payload)
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save the Call to Action. Please try again.')
    } finally { setPending(null) }
  }
  const changeContact = (content: ContactContent) => {
    if (!selectedContactSection) return
    setError(null)
    setDraft((current) => current ? {
      ...current,
      pages: current.pages.map((page) => page.id !== activePage.id ? page : {
        ...page,
        sections: page.sections.map((section) => section.id === selectedContactSection.id && isContactSection(section) ? { ...section, content } : section)
      })
    } : current)
    setEditorDirty(true)
  }
  const saveContact = async () => {
    if (!selectedContactSection || pending) return
    const validationError = contactContentError(selectedContactSection.content)
    if (validationError) { setError(validationError); return }
    const title = selectedContactSection.content.title.trim()
    const text = selectedContactSection.content.text?.trim() ?? ''
    const buttonLabel = selectedContactSection.content.buttonLabel.trim()
    const action = selectedContactSection.content.action.type === 'leadForm'
      ? { type: 'leadForm' as const }
      : { type: selectedContactSection.content.action.type, value: selectedContactSection.content.action.value.trim() }
    setPending('saveContact'); setError(null)
    try {
      const definition = await updateSectionContent(tenantId, activePage.id, selectedContactSection.id, { title, ...(text ? { text } : {}), buttonLabel, action })
      acceptCanonicalSite(definition)
      setEditorSessionRevision((revision) => revision + 1)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) setError(caught.message)
      else setError('Unable to save Contact. Please try again.')
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
  const showAboutInspector = Boolean(selectedAboutSection && (!editor || editor === 'page'))
  const showServicesInspector = Boolean(selectedServicesSection && (!editor || editor === 'page'))
  const showGalleryInspector = Boolean(selectedGallerySection && (!editor || editor === 'page'))
  const showLogosInspector = Boolean(selectedLogosSection && (!editor || editor === 'page'))
  const showTestimonialsInspector = Boolean(selectedTestimonialsSection && (!editor || editor === 'page'))
  const showFaqInspector = Boolean(selectedFaqSection && (!editor || editor === 'page'))
  const showCtaInspector = Boolean(selectedCtaSection && (!editor || editor === 'page'))
  const showContactInspector = Boolean(selectedContactSection && (!editor || editor === 'page'))
  const showDeferredSectionInspector = Boolean(editor === 'page' && selectedSection && !selectedHero && !selectedAboutSection && !selectedServicesSection && !selectedGallerySection && !selectedLogosSection && !selectedTestimonialsSection && !selectedFaqSection && !selectedCtaSection && !selectedContactSection && !showLegacySectionInspector)
  const activeToolEditor = activeSiteTool ? <ActiveWebsiteEditor editor={activeSiteTool} key={`${activeSiteTool}:${activePage.id}:${selectedSectionId ?? 'manager'}:${editorSessionRevision}`} onBackToPages={(pageId) => typeof pageId === 'string' ? selectPage(pageId) : selectEditor('pages')} onCancel={backToSiteTools} onControllerChange={setToolController} onDirtyChange={handleDirtyChange} onEditSection={(sectionId) => selectCanvasSection(sectionId)} onLivePreview={applyLivePreview} onPreviewPage={handlePreview} onRefresh={refreshWorkingSite} onSaved={handleEditorSaved} onSelectSeoContext={selectSeoContext} pageId={activeSiteTool === 'seo' ? queryPageId : undefined} site={site} tenantId={tenantId} /> : null
  // Non-migrated editors remain in their established card presentation.
  const legacyInspector = editor && !activeSiteTool && !fullScreenToolId && !showHeroInspector && !showAboutInspector && !showServicesInspector && !showGalleryInspector && !showLogosInspector && !showTestimonialsInspector && !showFaqInspector && !showCtaInspector && !showContactInspector && !showDeferredSectionInspector ? <ActiveWebsiteEditor editor={editor} key={`${editor}:${activePage.id}:${selectedSectionId ?? 'manager'}:${editorSessionRevision}`} onBackToPages={(pageId) => typeof pageId === 'string' ? selectPage(pageId) : selectEditor('pages')} onCancel={() => selectEditor('overview')} onDirtyChange={handleDirtyChange} onEditSection={(sectionId) => selectCanvasSection(sectionId)} onPreviewPage={handlePreview} onRefresh={refreshWorkingSite} onSaved={handleEditorSaved} onSelectSeoContext={selectSeoContext} pageId={editor === 'page' || editor === 'seo' ? activePage.id : undefined} sectionId={editor === 'page' ? selectedSectionId : undefined} site={site} tenantId={tenantId} /> : null
  const inspector = showHeroInspector && selectedHero
    ? <HeroDraftInspector hero={selectedHero} onChange={changeHero} saving={pending === 'saveHero'} />
    : showAboutInspector && selectedAboutSection
      ? <AboutDraftInspector onChange={changeAbout} onOpenMediaPicker={() => setMediaPickerSectionId(selectedAboutSection.id)} saving={pending === 'saveAbout'} section={selectedAboutSection} />
      : showServicesInspector && selectedServicesSection
        ? <ServicesDraftInspector onChange={changeServices} saving={pending === 'saveServices'} section={selectedServicesSection} />
      : showGalleryInspector && selectedGallerySection
        ? <GalleryDraftInspector onChange={changeGallery} onOpenMediaPicker={() => setMediaPickerSectionId(selectedGallerySection.id)} saving={pending === 'saveGallery'} section={selectedGallerySection} />
        : showLogosInspector && selectedLogosSection
          ? <LogosDraftInspector onChange={changeLogos} onOpenMediaPicker={() => setMediaPickerSectionId(selectedLogosSection.id)} saving={pending === 'saveLogos'} section={selectedLogosSection} />
          : showTestimonialsInspector && selectedTestimonialsSection
            ? <TestimonialsDraftInspector onChange={changeTestimonials} saving={pending === 'saveTestimonials'} section={selectedTestimonialsSection} />
            : showFaqInspector && selectedFaqSection
              ? <FaqDraftInspector onChange={changeFaq} saving={pending === 'saveFaq'} section={selectedFaqSection} />
              : showCtaInspector && selectedCtaSection
                ? <CtaDraftInspector onChange={changeCta} saving={pending === 'saveCta'} section={selectedCtaSection} />
                : showContactInspector && selectedContactSection
                  ? <ContactDraftInspector onChange={changeContact} saving={pending === 'saveContact'} section={selectedContactSection} />
                  : showDeferredSectionInspector && selectedSection
                    ? <DeferredSectionInspector onOpenExistingControls={() => setShowLegacySectionInspector(true)} section={selectedSection} />
                    : legacyInspector ?? <WebsiteOverview domain={domain} onManagePages={() => selectEditor('pages')} onUnpublish={unpublish} pending={pending} site={site} tenantId={tenantId} />
  const visibilityDisabled = editorDirty || Boolean(pending) || addBusy || pendingAddType !== null
  const visibilityDisabledReason = editorDirty
    ? 'Save or discard your changes first.'
    : visibilityDisabled
      ? 'Please wait for the current update to finish.'
      : undefined
  const railOverride = mediaPickerSectionId === selectedAboutSection?.id
    ? <MediaPicker disabled={pending === 'saveAbout'} onClose={() => setMediaPickerSectionId(null)} onSelect={selectAboutMedia} sectionLabel="About image" selectedMediaIds={selectedAboutSection.content.imageMediaId ? [selectedAboutSection.content.imageMediaId] : []} selectionDisabled={false} showCapacity={false} tenantId={tenantId} />
    : mediaPickerSectionId === selectedGallerySection?.id
      ? <MediaPicker disabled={pending === 'saveGallery'} onClose={() => setMediaPickerSectionId(null)} onSelect={selectGalleryMedia} selectedMediaIds={selectedGallerySection.content.items.map((item) => item.mediaId)} selectionDisabled={selectedGallerySection.content.items.length >= 20} tenantId={tenantId} />
      : mediaPickerSectionId === selectedLogosSection?.id
        ? <MediaPicker capacity={24} disabled={pending === 'saveLogos'} onClose={() => setMediaPickerSectionId(null)} onSelect={selectLogosMedia} sectionLabel="Logos section" selectedMediaIds={selectedLogosSection.content.items.map((item) => item.mediaId)} selectionDisabled={selectedLogosSection.content.items.length >= 24} tenantId={tenantId} />
      : addingSection
        ? <AddSectionPanel busy={addBusy} error={addError} onBack={closeAddSection} onChoose={chooseAddSection} pageId={activePage.id} site={draftSite} />
        : moreSettingsOpen
          ? <MoreSettingsPanel onBack={openSiteTools} onSelect={(next) => { setMoreSettingsOpen(false); selectEditor(next) }} />
          : activeToolEditor ?? undefined
  const heroToolbarActive = showHeroInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const aboutToolbarActive = showAboutInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const servicesToolbarActive = showServicesInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const galleryToolbarActive = showGalleryInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const logosToolbarActive = showLogosInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const testimonialsToolbarActive = showTestimonialsInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const faqToolbarActive = showFaqInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const ctaToolbarActive = showCtaInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const contactToolbarActive = showContactInspector && !addingSection && !moreSettingsOpen && !siteToolsMenuOpen
  const toolbarCanSave = activeSiteTool ? Boolean(toolController?.canSave) : heroToolbarActive ? true : aboutToolbarActive && selectedAboutSection ? aboutContentError(selectedAboutSection.content) === null : servicesToolbarActive && selectedServicesSection ? servicesContentError(selectedServicesSection.content) === null : galleryToolbarActive && selectedGallerySection ? galleryContentError(selectedGallerySection.content) === null : logosToolbarActive && selectedLogosSection ? logosContentError(selectedLogosSection.content) === null : testimonialsToolbarActive && selectedTestimonialsSection ? testimonialsContentError(selectedTestimonialsSection.content) === null : faqToolbarActive && selectedFaqSection ? faqContentError(selectedFaqSection.content) === null : ctaToolbarActive && selectedCtaSection ? ctaContentError(selectedCtaSection.content) === null : contactToolbarActive && selectedContactSection ? contactContentError(selectedContactSection.content) === null : false
  const toolbarSaving = Boolean(pending) || addBusy || Boolean(activeSiteTool && toolController?.saving)
  const toolbarSave = activeSiteTool ? () => toolController?.save() : () => { if (heroToolbarActive) void saveHero(); else if (aboutToolbarActive) void saveAbout(); else if (servicesToolbarActive) void saveServices(); else if (galleryToolbarActive) void saveGallery(); else if (logosToolbarActive) void saveLogos(); else if (testimonialsToolbarActive) void saveTestimonials(); else if (faqToolbarActive) void saveFaq(); else if (ctaToolbarActive) void saveCta(); else if (contactToolbarActive) void saveContact() }
  const handleFullScreenSaved = (definition: SiteDefinition) => {
    acceptCanonicalSite(definition)
    setError(null)
    setEditorSessionRevision((revision) => revision + 1)
    const home = definition.pages.find((page) => page.id === 'home') ?? definition.pages[0]
    const hero = home?.sections.find((section) => section.type === 'hero') ?? home?.sections[0]
    if (home) navigateToEditor('page', home.id, hero?.id)
    else navigateToEditor('overview')
  }
  const fullScreenTool = fullScreenToolId === 'templates'
    ? <TemplatesEditor onBack={backToSiteTools} onSaved={handleFullScreenSaved} site={site} tenantId={tenantId} />
    : fullScreenToolId === 'revisions'
      ? <RevisionHistoryEditor onBack={backToSiteTools} onSaved={handleFullScreenSaved} tenantId={tenantId} />
      : undefined

  return (
    <div className="h-full min-h-[calc(100svh-4rem)] w-full min-w-0 lg:min-h-0">
      {(error || previewFallback || offerHomePreview) && <div className="mb-5 space-y-3" aria-live="polite">{error && <StatusMessage tone="error">{error}</StatusMessage>}{previewFallback && <StatusMessage>Your browser blocked the preview tab. <a className="font-semibold underline underline-offset-2" href={previewFallback} rel="noopener noreferrer" target="_blank">Open preview</a></StatusMessage>}{offerHomePreview && <Button onClick={() => handlePreview('home')} variant="secondary">Preview Home</Button>}</div>}
      <WebsiteEditorCanvas canSave={toolbarCanSave} canonical={site} dirty={editorDirty} fullScreenContext={fullScreenToolId === 'templates' ? 'Viewing templates' : fullScreenToolId === 'revisions' ? 'Viewing history' : undefined} fullScreenTool={fullScreenTool} inspector={inspector} onAddSection={() => { setAddingSection(true); setPendingAddType(null); setAddError(null) }} onOpenPreview={() => handlePreview(activePage.id)} onOpenSiteTools={openSiteTools} onPageSelected={selectCanvasPage} onPublish={publish} onSave={toolbarSave} onSectionSelected={selectCanvasSection} onToggleVisibility={toggleVisibility} page={activePage} railOverride={siteToolsMenuOpen ? <SiteToolsPanel onBack={() => { setSiteToolsMenuOpen(false); selectEditor('overview') }} onMoreSettings={() => { setSiteToolsMenuOpen(false); setMoreSettingsOpen(true) }} onSelect={selectSiteTool} /> : railOverride} saving={toolbarSaving} selectedSectionId={selectedSectionId} site={draftSite} visibilityDisabled={visibilityDisabled} visibilityDisabledReason={visibilityDisabledReason} />
      <ConfirmDialog cancelLabel="Keep editing" confirmLabel="Discard changes" description={`Your changes in ${editor ? websiteEditorById.get(editor)?.label ?? 'this editor' : 'this editor'} haven't been saved.`} onCancel={() => { setPendingPane(null); setOpenSiteToolsAfterDiscard(false) }} onConfirm={() => { const destination = pendingPane; const openTools = openSiteToolsAfterDiscard; setPendingPane(null); setOpenSiteToolsAfterDiscard(false); setDraft(cloneSite(site)); setEditorDirty(false); if (openTools) openSiteTools(); else if (destination) navigateToEditor(destination.editor, destination.pageId, destination.sectionId) }} open={pendingPane !== null} title="Discard unsaved changes?" />
      <ConfirmDialog cancelLabel="Keep editing" confirmLabel="Discard changes" description={pendingAddType ? `Adding ${sectionDefinitions[pendingAddType].label} discards your unsaved changes.` : ''} onCancel={() => setPendingAddType(null)} onConfirm={() => { const type = pendingAddType; setPendingAddType(null); if (!type) return; acceptCanonicalSite(site); void performAddSection(type) }} open={pendingAddType !== null} title="Discard unsaved changes?" />
    </div>
  )
}
