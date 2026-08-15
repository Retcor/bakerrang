import { notFound } from 'next/navigation'
import { findHomePage } from '@bakerrang/site-schema'
import { SectionRenderer } from '../../../components/SectionRenderer'
import { getPublicSite } from '../../../lib/api'

export interface TenantSitePageProps {
  params: Promise<{ tenantId: string }>
}

export default async function TenantSitePage ({ params }: TenantSitePageProps) {
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  if (!site) notFound()

  const home = findHomePage(site)
  if (!home) notFound()

  return (
    <main>
      {home.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} tenantId={tenantId} />
      ))}
    </main>
  )
}
