import { BusinessMedia } from '../../BusinessMedia'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function MediaPage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Review uploaded images and delete ones that are not used on the working or published site." tenantId={tenantId} title="Media"><BusinessMedia tenantId={tenantId} /></BusinessWorkspace>
}
