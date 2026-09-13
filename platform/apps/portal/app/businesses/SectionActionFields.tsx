import { Input, Select } from '@bakerrang/ui'
import type { LinkActionInput } from '../../lib/site'

export type SectionActionType = LinkActionInput['type'] | 'leadForm'
const labels: Record<SectionActionType, string> = { email: 'Email', phone: 'Phone', url: 'Website URL', leadForm: 'Lead Form' }
const placeholders: Partial<Record<SectionActionType, string>> = { email: 'hello@example.com', phone: '(801) 555-1234', url: 'https://example.com' }
const limits: Partial<Record<SectionActionType, number>> = { email: 254, phone: 50, url: 2048 }

export function SectionActionFields ({ allowLeadForm = false, disabled, id, type, value, onTypeChange, onValueChange }: {
  allowLeadForm?: boolean, disabled?: boolean, id: string, type: SectionActionType, value: string,
  onTypeChange: (type: SectionActionType) => void, onValueChange: (value: string) => void
}) {
  const types: SectionActionType[] = allowLeadForm ? ['email', 'phone', 'url', 'leadForm'] : ['email', 'phone', 'url']
  return <><label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`${id}-type`}>Action Type</label>
    <Select className="mt-2" disabled={disabled} id={`${id}-type`} onChange={(event) => { onTypeChange(event.target.value as SectionActionType); onValueChange('') }} value={type}>{types.map((kind) => <option key={kind} value={kind}>{labels[kind]}</option>)}</Select>
    {type !== 'leadForm' && <><label className="mt-4 block text-sm font-semibold text-fg" htmlFor={`${id}-value`}>Action Value</label><Input className="mt-2" disabled={disabled} id={`${id}-value`} maxLength={limits[type]} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholders[type]} value={value} /></>}
  </>
}
