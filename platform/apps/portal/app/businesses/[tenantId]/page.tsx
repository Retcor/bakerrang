import { BusinessOverview, BusinessWorkspace } from '../BusinessWorkspace'

export default async function BusinessOverviewPage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Choose an area to manage this business." tenantId={tenantId} title="Overview"><BusinessOverview tenantId={tenantId} /></BusinessWorkspace>
}
