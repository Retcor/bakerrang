import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { findPageById } from '@bakerrang/site-schema'
import { PreviewFrame } from '../../../../../components/PreviewFrame'
import { PublicPage } from '../../../../../components/PublicPage'
import { getPreviewSite } from '../../../../../lib/api'
import { previewHostAllowed, resolvePreviewMetadata } from '../../../../../lib/preview'

export const dynamic = 'force-dynamic'
export async function generateMetadata (props: { params: Promise<{ tenantId: string, pageId: string }>, searchParams: Promise<{ token?: string | string[] }> }): Promise<Metadata> { return resolvePreviewMetadata(props) }
export default async function PreviewGenericPage ({ params, searchParams }: { params: Promise<{ tenantId: string, pageId: string }>, searchParams: Promise<{ token?: string | string[] }> }) {
  if (!previewHostAllowed((await headers()).get('host'))) notFound()
  const [{ tenantId, pageId }, query] = await Promise.all([params, searchParams]); const token = typeof query.token === 'string' && query.token ? query.token : null
  if (!token) notFound()
  const site = await getPreviewSite(tenantId, token); const page = site ? findPageById(site, pageId) : undefined
  if (!site || !page) notFound()
  return <PreviewFrame tenantId={tenantId} token={token}><PublicPage page={page} preview site={site} siteBaseUrl={null} sitePath={`/preview/${encodeURIComponent(tenantId)}/page/${encodeURIComponent(pageId)}`} tenantId={tenantId} /></PreviewFrame>
}
