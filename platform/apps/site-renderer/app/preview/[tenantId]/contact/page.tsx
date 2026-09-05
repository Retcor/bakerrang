import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { findHomePage, isContactSection } from '@bakerrang/site-schema'
import { PreviewFrame } from '../../../../components/PreviewFrame'
import { PublicContact } from '../../../../components/PublicContact'
import { getPreviewSite } from '../../../../lib/api'
import { previewHostAllowed, resolvePreviewMetadata } from '../../../../lib/preview'

export const dynamic = 'force-dynamic'

export interface PreviewContactPageProps {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ token?: string | string[] }>
}

export async function generateMetadata (props: PreviewContactPageProps): Promise<Metadata> {
  return resolvePreviewMetadata(props, 'Contact Preview')
}

export default async function PreviewContactPage ({ params, searchParams }: PreviewContactPageProps) {
  if (!previewHostAllowed((await headers()).get('host'))) notFound()
  const [{ tenantId }, query] = await Promise.all([params, searchParams])
  const token = typeof query.token === 'string' && query.token ? query.token : null
  if (!token) notFound()
  const site = await getPreviewSite(tenantId, token)
  if (!site) notFound()
  const contact = findHomePage(site)?.sections.find(isContactSection)
  if (!contact || contact.content.action.type !== 'leadForm') notFound()
  return (
    <PreviewFrame tenantId={tenantId} token={token}>
      <PublicContact
        contact={contact}
        preview
        site={site}
        sitePath={`/preview/${encodeURIComponent(tenantId)}`}
        tenantId={tenantId}
      />
    </PreviewFrame>
  )
}
