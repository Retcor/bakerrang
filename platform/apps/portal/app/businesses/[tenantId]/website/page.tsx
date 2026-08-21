import { BusinessWebsite } from '../../BusinessWebsite'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function WebsitePage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Edit site content and keep publishing controls close at hand." tenantId={tenantId} title="Website"><BusinessWebsite autoLoad tenantId={tenantId} /></BusinessWorkspace>
}
