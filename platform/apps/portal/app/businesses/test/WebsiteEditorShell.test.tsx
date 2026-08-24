import { fireEvent, render, screen } from '@testing-library/react'
import type { FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WebsiteEditorShell } from '../WebsiteEditorShell'

describe('WebsiteEditorShell', () => {
  it('uses shared metadata, error chrome, uniform actions, sticky layout, and width modes', () => {
    const dirty = vi.fn()
    const { container, rerender } = render(
      <WebsiteEditorShell dirtyValue="seed" editor="faq" error="Request failed" onCancel={() => undefined} onDirtyChange={dirty} onSubmit={(event) => event.preventDefault()} saving={false} secondaryActions={<button type="button">Remove item</button>}>
        <input aria-label="Question" />
      </WebsiteEditorShell>
    )
    expect(screen.getByText('Homepage')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByText('Answer common questions on the homepage.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Request failed')
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove item' })).toBeInTheDocument()
    expect(screen.getByTestId('website-editor-actions')).toHaveClass('sticky', 'bottom-0', 'flex-col', 'sm:flex-row')
    expect(screen.getByTestId('website-editor-secondary-actions')).toContainElement(screen.getByRole('button', { name: 'Remove item' }))
    expect(screen.getByTestId('website-editor-primary-actions')).toContainElement(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByTestId('website-editor-primary-actions')).toHaveClass('w-full', 'justify-end', 'sm:w-auto')
    expect(container.querySelector('form')).toHaveClass('max-w-3xl')

    rerender(<WebsiteEditorShell dirtyValue="changed" editor="faq" onCancel={() => undefined} onDirtyChange={dirty} onSubmit={(event) => event.preventDefault()} saving width="wide"><input /></WebsiteEditorShell>)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(container.querySelector('form')).toHaveClass('max-w-5xl')
    expect(dirty).toHaveBeenCalledWith(true)
  })

  it('submits through the shared Save action', () => {
    const submit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault())
    render(<WebsiteEditorShell dirtyValue={{ value: '' }} editor="hero" onCancel={() => undefined} onDirtyChange={() => undefined} onSubmit={submit} saving={false}><input /></WebsiteEditorShell>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(submit).toHaveBeenCalledOnce()
  })
})
