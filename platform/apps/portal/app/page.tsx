import { AppShell } from './_shell/AppShell'
import { PageHeader } from './_shell/PageHeader'
import { BusinessManager } from './businesses/BusinessManager'

export default function PortalPage () {
  return (
    <AppShell>
      <PageHeader description="Create and manage every business in your BakerRang workspace." eyebrow="Workspace" title="Businesses" />
      <BusinessManager />
    </AppShell>
  )
}
