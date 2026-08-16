import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { SiteShell } from '@bakerrang/site-components'
import { SectionRenderer } from '../../../components/SectionRenderer'
import { getPublicSite } from '../../../lib/api'
import { homeMetadata } from '../../../lib/seo'
import { BusinessJsonLd } from '../../../components/BusinessJsonLd'

export interface TenantSitePageProps {
  params: Promise<{ tenantId: string }>
}

export async function generateMetadata ({ params }: TenantSitePageProps): Promise<Metadata> {
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  return site ? homeMetadata(site, tenantId) : { title: 'Website', robots: { index: false, follow: false } }
}

export default async function TenantSitePage ({ params }: TenantSitePageProps) {
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  if (!site) notFound()

  const home = findHomePage(site)
  if (!home) notFound()
  const hasContact = home.sections.some(isContactSection)

  return (
    <SiteShell currentPage="home" site={site} tenantId={tenantId}>
      <BusinessJsonLd site={site} tenantId={tenantId} />
      <main>
        {home.sections.map((section) => (
          <SectionRenderer heroContactHref={hasContact ? '#contact' : undefined} key={section.id} section={section} tenantId={tenantId} />
        ))}
      </main>
    </SiteShell>
  )
}
