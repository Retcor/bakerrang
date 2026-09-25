// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StageRule, TurnActions } from './App.jsx'

afterEach(cleanup)

const turn = { id: 'stable-turn-42', n: 42, toName: 'Spanish' }

describe('turn actions', () => {
  it('labels the final live stage Shown when the snapshotted turn has no voice', () => {
    render(<StageRule turn={{ phase: 'translating', said: '' }} hasVoice={false} />)
    expect(screen.getByText('Heard')).toBeTruthy()
    expect(screen.getByText('Translated')).toBeTruthy()
    expect(screen.getByText('Shown')).toBeTruthy()
    expect(screen.queryByText('Spoken')).toBeNull()
  })

  it('targets older-turn Copy and Replay actions by stable turn id and returns focus', async () => {
    const onCopy = vi.fn()
    const onReplay = vi.fn()
    render(<TurnActions turn={turn} newest={false} voice={{ id: 'voice-a', name: 'Jamie' }} copied={false} onCopy={onCopy} onReplay={onReplay} />)
    const trigger = screen.getByRole('button', { name: 'Actions for turn 42' })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Copy Spanish text' })).toBe(document.activeElement))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Spanish text' }))
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('stable-turn-42'))
    await waitFor(() => expect(trigger).toBe(document.activeElement))

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Say it again in Jamie' }))
    await waitFor(() => expect(onReplay).toHaveBeenCalledWith('stable-turn-42'))
  })

  it('omits Replay for a no-voice turn and dismisses the touch menu with Escape', async () => {
    render(<TurnActions turn={turn} newest={false} voice={null} copied={false} onCopy={vi.fn()} onReplay={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Actions for turn 42' })
    fireEvent.click(trigger)
    expect(screen.queryByText(/Say it again/)).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(trigger).toBe(document.activeElement))
  })
})
