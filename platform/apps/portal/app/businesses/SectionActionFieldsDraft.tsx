import type { ContactAction, LinkAction } from '@bakerrang/site-schema'
import { Input, Select } from '@bakerrang/ui'

type SharedProps = {
  idBase: string
  buttonLabel: string
  buttonLabelMax: number
  disabled: boolean
}

type LinkOnlyProps = SharedProps & {
  allowLeadForm?: false
  action: LinkAction
  onChange: (next: { buttonLabel: string, action: LinkAction }) => void
}

type ContactProps = SharedProps & {
  allowLeadForm: true
  action: ContactAction
  onChange: (next: { buttonLabel: string, action: ContactAction }) => void
}

export type SectionActionFieldsDraftProps = LinkOnlyProps | ContactProps

const destinationFields: Record<LinkAction['type'], { label: string, maxLength: number, inputMode: 'email' | 'tel' | 'url', placeholder: string }> = {
  url: { label: 'Website URL', maxLength: 2048, inputMode: 'url', placeholder: 'https://example.com' },
  email: { label: 'Email address', maxLength: 254, inputMode: 'email', placeholder: 'hello@example.com' },
  phone: { label: 'Phone number', maxLength: 50, inputMode: 'tel', placeholder: '(801) 555-1234' }
}

function isLinkActionType (value: string): value is LinkAction['type'] {
  return value === 'url' || value === 'email' || value === 'phone'
}

function LeadFormIcon () {
  return <svg aria-hidden className="mt-px size-4 shrink-0 fill-none stroke-info [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24"><rect height="16" rx="2" width="16" x="4" y="4" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
}

export function SectionActionFieldsDraft (props: SectionActionFieldsDraftProps) {
  const changeButtonLabel = (buttonLabel: string) => {
    if (props.allowLeadForm) props.onChange({ buttonLabel, action: props.action })
    else props.onChange({ buttonLabel, action: props.action })
  }
  const changeType = (value: string) => {
    if (props.allowLeadForm && value === 'leadForm') {
      props.onChange({ buttonLabel: props.buttonLabel, action: { type: 'leadForm' } })
      return
    }
    if (!isLinkActionType(value)) return
    const action: LinkAction = { type: value, value: '' }
    if (props.allowLeadForm) props.onChange({ buttonLabel: props.buttonLabel, action })
    else props.onChange({ buttonLabel: props.buttonLabel, action })
  }
  const changeValue = (value: string) => {
    if (props.action.type === 'leadForm') return
    const action: LinkAction = { ...props.action, value }
    if (props.allowLeadForm) props.onChange({ buttonLabel: props.buttonLabel, action })
    else props.onChange({ buttonLabel: props.buttonLabel, action })
  }

  const destination = props.action.type === 'leadForm' ? null : destinationFields[props.action.type]
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`${props.idBase}-button-label`}>Button label</label>
          <span aria-hidden className="text-xs tabular-nums text-fg-subtle">{props.buttonLabel.length} / {props.buttonLabelMax}</span>
        </div>
        <Input className="mt-1.5" disabled={props.disabled} id={`${props.idBase}-button-label`} maxLength={props.buttonLabelMax} onChange={(event) => changeButtonLabel(event.target.value)} value={props.buttonLabel} />
      </div>
      <div>
        <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`${props.idBase}-action-type`}>Where it goes</label>
        <Select className="mt-1.5" disabled={props.disabled} id={`${props.idBase}-action-type`} onChange={(event) => changeType(event.target.value)} value={props.action.type}>
          <option value="url">Website URL</option>
          <option value="email">Email address</option>
          <option value="phone">Phone number</option>
          {props.allowLeadForm && <option value="leadForm">Lead form</option>}
        </Select>
      </div>
      {destination && props.action.type !== 'leadForm' && <div>
        <label className="text-[0.8125rem] font-semibold text-fg" htmlFor={`${props.idBase}-action-value`}>{destination.label}</label>
        <Input className="mt-1.5" disabled={props.disabled} id={`${props.idBase}-action-value`} inputMode={destination.inputMode} maxLength={destination.maxLength} onChange={(event) => changeValue(event.target.value)} placeholder={destination.placeholder} value={props.action.value} />
      </div>}
      {props.action.type === 'leadForm' && <p className="flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs leading-5 text-fg-muted"><LeadFormIcon />Visitors fill in an on-page form. Replies land in your Leads inbox — no destination needed.</p>}
    </div>
  )
}
