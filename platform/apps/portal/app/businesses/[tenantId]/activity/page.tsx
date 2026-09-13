import { BusinessActivity } from '../../BusinessActivity'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function ActivityPage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Review meaningful operator changes to this business." tenantId={tenantId} title="Activity"><BusinessActivity tenantId={tenantId} /></BusinessWorkspace>
}
