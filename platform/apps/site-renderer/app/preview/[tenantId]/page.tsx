import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { findHomePage } from '@bakerrang/site-schema'
import { PreviewFrame } from '../../../components/PreviewFrame'
import { PublicHome } from '../../../components/PublicHome'
import { getPreviewSite } from '../../../lib/api'
import { previewHostAllowed, previewMetadata } from '../../../lib/preview'

export const dynamic = 'force-dynamic'

export interface PreviewPageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ token?: string | string[] }>
}

export function generateMetadata (): Metadata {
  return previewMetadata()
}

export default async function PreviewPage ({ params, searchParams }: PreviewPageProps) {
  if (!previewHostAllowed((await headers()).get('host'))) notFound()
  const [{ tenantId }, query] = await Promise.all([params, searchParams])
  const token = typeof query.token === 'string' && query.token ? query.token : null
  if (!token) notFound()
  const site = await getPreviewSite(tenantId, token)
  if (!site || !findHomePage(site)) notFound()
  return (
    <PreviewFrame tenantId={tenantId} token={token}>
      <PublicHome
        previewToken={token}
        site={site}
        siteBaseUrl={null}
        sitePath={`/preview/${encodeURIComponent(tenantId)}`}
      />
    </PreviewFrame>
  )
}
