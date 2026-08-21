import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { Field } from '../Field'
import { FileInput } from '../FileInput'
import { Input } from '../Input'
import { Select } from '../Select'

describe('Button', () => {
  it('applies an explicit variant and size', () => {
    render(<Button size="sm" variant="secondary">Edit</Button>)
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass('bg-surface', 'min-h-10')
  })

  it('preserves native disabled behavior', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('Badge', () => {
  it('renders its text and semantic tone', () => {
    render(<Badge tone="success">Active</Badge>)
    expect(screen.getByText('Active')).toHaveClass('bg-success-subtle', 'text-success-fg')
  })
})

describe('Field', () => {
  it('wires label and help text to its control', () => {
    render(<Field help="Shown publicly" id="business-name" label="Business name"><Input /></Field>)
    const input = screen.getByLabelText('Business name')
    expect(input).toHaveAttribute('id', 'business-name')
    expect(input).toHaveAccessibleDescription('Shown publicly')
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('prioritizes an accessible error', () => {
    render(<Field error="Required" help="Helpful" id="name" label="Name"><Input /></Field>)
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Required')
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('FileInput', () => {
  it('associates the picker label and reports the selected filename', () => {
    const onChange = vi.fn()
    render(<FileInput accept="image/png" fileName="brand-photo.png" id="brand-photo" onChange={onChange} />)

    const input = screen.getByLabelText('Choose image')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', 'image/png')
    expect(input).toHaveAccessibleDescription('brand-photo.png')
    fireEvent.change(input, { target: { files: [new File(['image'], 'brand-photo.png', { type: 'image/png' })] } })
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('ConfirmDialog', () => {
  it('supports confirm and Escape close behavior', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(<ConfirmDialog description="This cannot be undone." onCancel={onCancel} onConfirm={onConfirm} open title="Remove item?" />)
    expect(screen.getByRole('dialog', { name: 'Remove item?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render dialog content while closed', () => {
    render(<ConfirmDialog description="Hidden" onCancel={() => undefined} onConfirm={() => undefined} open={false} title="Closed" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Select', () => {
  it('retains native label association and value changes', () => {
    render(<><label htmlFor="status">Status</label><Select defaultValue="new" id="status"><option value="new">New</option><option value="won">Won</option></Select></>)
    const select = screen.getByLabelText('Status')
    fireEvent.change(select, { target: { value: 'won' } })
    expect(select).toHaveValue('won')
  })
})
