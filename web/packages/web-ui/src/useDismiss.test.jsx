// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDismiss } from './index.jsx'

afterEach(cleanup)

const Fixture = ({ onDismiss }) => {
  const [open, setOpen] = useState(true)
  const ref = useDismiss({ open, onDismiss: () => { setOpen(false); onDismiss() } })
  return <div><div ref={ref}><button>Inside</button>{open && <span>Open</span>}</div><button>Outside</button></div>
}

it('dismisses on outside pointer and Escape but not an inside pointer', () => {
  const onDismiss = vi.fn()
  const { rerender } = render(<Fixture onDismiss={onDismiss} />)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Inside' }))
  expect(onDismiss).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'Enter' })
  expect(onDismiss).not.toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onDismiss).toHaveBeenCalledTimes(1)

  rerender(<Fixture key='second' onDismiss={onDismiss} />)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
  expect(onDismiss).toHaveBeenCalledTimes(2)
})
