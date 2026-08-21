import { CustomDomainEditor } from '../../CustomDomainEditor'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function DomainPage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Configure a customer-owned hostname without changing published content." tenantId={tenantId} title="Custom domain"><CustomDomainEditor tenantId={tenantId} /></BusinessWorkspace>
}
