import { BusinessLeads } from '../../BusinessLeads'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function LeadsPage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Review enquiries, move work forward, and keep notes together." tenantId={tenantId} title="Leads"><BusinessLeads autoLoad tenantId={tenantId} /></BusinessWorkspace>
}
