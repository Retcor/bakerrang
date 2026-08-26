import { Suspense } from 'react'
import { StatusMessage } from '@bakerrang/ui'
import { BusinessWebsite } from '../../BusinessWebsite'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function WebsitePage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Edit site content and keep publishing controls close at hand." tenantId={tenantId} title="Website"><Suspense fallback={<StatusMessage>Loading website…</StatusMessage>}><BusinessWebsite autoLoad tenantId={tenantId} /></Suspense></BusinessWorkspace>
}
