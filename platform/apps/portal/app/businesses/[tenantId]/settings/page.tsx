import { BusinessLifecycle } from '../../BusinessLifecycle'
import { BusinessWorkspace } from '../../BusinessWorkspace'

export default async function SettingsPage ({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  return <BusinessWorkspace description="Export business data or manage permanent deletion." tenantId={tenantId} title="Settings"><BusinessLifecycle tenantId={tenantId} /></BusinessWorkspace>
}
