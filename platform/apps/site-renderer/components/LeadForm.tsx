'use client'

import { LeadForm as RuntimeLeadForm } from '@bakerrang/site-runtime'
import type { RenderContext } from '@bakerrang/site-runtime'
import { submitLead } from '../lib/leads'

export interface LeadFormProps {
  tenantId: string
  context: Pick<RenderContext, 'mode'>
}

export function LeadForm ({ context, tenantId }: LeadFormProps) {
  return <RuntimeLeadForm context={context} onSubmit={(input) => submitLead(tenantId, input)} />
}
