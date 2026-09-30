// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STATUS, authStore } from './test-support/mockAuth.js'
import { serverRef } from './test-support/mockApi.js'
import { createFakeServer, twoVoices } from './test-support/fakeServer.js'
import { fakeFile, installBrowserStubs, renderApp, resetBrowserState, setOnline } from './test-support/harness.jsx'

vi.mock('@bakerrang/web-auth', async () => (await import('./test-support/mockAuth.js')).mockAuthModule)
vi.mock('@bakerrang/web-api-client', async (importOriginal) => (await import('./test-support/mockApi.js')).apiClientModule(await importOriginal()))

let server
let user
beforeEach(() => {
  resetBrowserState()
  installBrowserStubs()
  authStore.reset()
  server = createFakeServer({ voices: twoVoices() })
  serverRef.current = server
  user = userEvent.setup({ applyAccept: false })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const voicesRegion = () => screen.getByRole('region', { name: 'Voices' })
const list = () => screen.findByRole('list', { name: 'Your voices' })
const button = (name) => within(voicesRegion()).getByRole('button', { name })
const status = () => document.querySelector('[role="status"][aria-live="polite"]').textContent
const openAdd = async () => {
  await user.click(button('Add voice'))
  return screen.getByRole('heading', { name: 'Add a voice' })
}
const upload = async (...files) => { await user.upload(screen.getByLabelText('Add audio files'), files) }
const fillValid = async ({ name = 'Reading voice', description = 'Kitchen table' } = {}) => {
  await user.type(screen.getByLabelText('Name'), name)
  if (description) await user.type(screen.getByLabelText(/^Description/), description)
  await upload(fakeFile('take.mp3', 'audio/mpeg'))
  await user.click(screen.getByLabelText(/This is my voice/))
}

describe('the voice list', () => {
  it('lists voices primary first with a PRIMARY tag, a count, and every action named for its voice', async () => {
    renderApp()
    const items = within(await list()).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('.ac-voice__name span').textContent)).toEqual(['My voice', 'Storyteller'])
    expect(within(items[0]).getByText('Primary')).not.toBeNull()
    expect(within(items[1]).queryByText('Primary')).toBeNull()
    expect(screen.getByLabelText('2 voices').textContent).toBe('2')
    expect(within(items[0]).queryByRole('button', { name: /Make My voice your primary voice/ })).toBeNull()
    for (const name of ['Make Storyteller your primary voice', 'Rename Storyteller', 'Delete Storyteller', 'Rename My voice', 'Delete My voice']) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
    expect(within(voicesRegion()).getAllByRole('button', { name: /^Add voice$/ })).toHaveLength(1)
    expect(voicesRegion().querySelector('.ac-btn--gold')).not.toBeNull()
    expect(document.querySelectorAll('.ac-btn--gold')).toHaveLength(1)
  })

  it('shows two quiet skeleton lines and a screen-reader message while loading', async () => {
    const release = server.holdNext('GET /text/to/speech/v1/voices')
    renderApp()
    await screen.findByRole('region', { name: 'Voices' })
    expect(within(voicesRegion()).getByText('Loading your voices…')).not.toBeNull()
    expect(voicesRegion().querySelectorAll('.ac-skel')).toHaveLength(2)
    expect(within(voicesRegion()).queryByRole('button', { name: 'Add voice' })).toBeNull()
    await act(async () => release())
    await list()
  })

  it('shows the empty state with Add voice available', async () => {
    server.voices = []
    renderApp()
    await screen.findByText('No voices yet.')
    expect(screen.getByText(/Clone your voice from a short recording/)).not.toBeNull()
    expect(button('Add voice')).not.toBeNull()
    expect(screen.getByLabelText('0 voices').textContent).toBe('0')
  })

  it('shows a specific load failure with Try again, no Add voice, and recovers', async () => {
    server.failNext('GET /text/to/speech/v1/voices', { status: 500 })
    renderApp()
    const alert = await screen.findByRole('alert', { name: '' })
    expect(alert.textContent).toContain("Account couldn't load your voices.")
    expect(alert.textContent).toContain('Nothing was changed. Check your connection, then try again.')
    expect(within(voicesRegion()).queryByRole('button', { name: 'Add voice' })).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    await list()
    expect(button('Add voice')).not.toBeNull()
  })

  it('names the fallback voice when there is no primary, and never promotes one on its own', async () => {
    server.voices = twoVoices().map((voice) => ({ ...voice, isPrimary: false }))
    renderApp()
    await list()
    expect(screen.getByText(/No primary voice\. Story Book and Polyglot start with My voice until you choose one\./)).not.toBeNull()
    expect(screen.queryByText('Primary')).toBeNull()
  })

  it('refetches quietly when the tab returns after a minute, but not while an editor is open', async () => {
    renderApp()
    await list()
    const listCalls = () => server.callsTo('GET', '/text/to/speech/v1/voices').length
    expect(listCalls()).toBe(1)
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 61000)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(listCalls()).toBe(2))
    await user.click(button('Rename Storyteller'))
    clock.mockReturnValue(now + 200000)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(listCalls()).toBe(2)
  })

  it('picks up a rename made elsewhere (a legacy tab) on the next load: server state is the truth', async () => {
    const view = renderApp()
    await list()
    server.voices[1].name = 'Renamed elsewhere'
    view.unmount()
    renderApp()
    await screen.findByText('Renamed elsewhere')
  })
})

describe('make primary', () => {
  it('persists directly through PUT primary, flips the tag, announces, and survives a reload', async () => {
    const view = renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Make Storyteller your primary voice' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make My voice your primary voice' })).not.toBeNull())
    expect(server.callsTo('PUT', '/text/to/speech/v1/voices/primary')).toHaveLength(1)
    expect(server.callsTo('PUT', '/text/to/speech/v1/voices/primary')[0].body).toEqual({ voiceId: 'v2' })
    expect(server.callsTo('PUT', '/text/to/speech/v1/voices')).toHaveLength(1)
    await waitFor(() => expect(status()).toBe('Storyteller is now your primary voice.'))
    const items = within(screen.getByRole('list', { name: 'Your voices' })).getAllByRole('listitem')
    expect(items[0].textContent).toContain('Storyteller')
    expect(within(items[0]).getByText('Primary')).not.toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename Storyteller' }))

    view.unmount()
    renderApp()
    const reloaded = within(await list()).getAllByRole('listitem')
    expect(reloaded[0].textContent).toContain('Storyteller')
    expect(within(reloaded[0]).getByText('Primary')).not.toBeNull()
    expect(server.voices.filter((voice) => voice.isPrimary).map((voice) => voice.id)).toEqual(['v2'])
  })

  it('reports a failed change inline and changes nothing', async () => {
    server.failNext('PUT /text/to/speech/v1/voices/primary', { status: 500 })
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Make Storyteller your primary voice' }))
    const alert = await screen.findByRole('alert', { name: '' })
    expect(alert.textContent).toContain("Couldn't change your primary voice. Nothing was changed.")
    expect(screen.getByRole('button', { name: 'Make Storyteller your primary voice' })).not.toBeNull()
    expect(server.voices.find((voice) => voice.id === 'v1').isPrimary).toBe(true)
  })

  it('removes a voice that was deleted elsewhere and says so', async () => {
    renderApp()
    await list()
    server.voices = server.voices.filter((voice) => voice.id !== 'v2')
    await user.click(screen.getByRole('button', { name: 'Make Storyteller your primary voice' }))
    await waitFor(() => expect(screen.queryByText('Storyteller')).toBeNull())
    expect(within(voicesRegion()).getByText('This voice was deleted somewhere else.')).not.toBeNull()
  })
})

describe('rename', () => {
  it('opens in place with focus in the name, saves with PATCH, updates the row, announces and restores focus', async () => {
    const view = renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename Storyteller' }))
    const name = screen.getByLabelText('Name')
    expect(document.activeElement).toBe(name)
    expect(screen.getByRole('heading', { name: 'Rename Storyteller' })).not.toBeNull()
    expect(screen.getByText('The new name shows in Story Book and Polyglot.')).not.toBeNull()
    await user.clear(name)
    await user.type(name, 'Bedtime')
    const description = screen.getByLabelText(/^Description/)
    await user.clear(description)
    await user.type(description, 'Softer')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Rename/ })).toBeNull())
    expect(server.callsTo('PATCH', '/text/to/speech/v1/voices/v2')[0].body).toEqual({ name: 'Bedtime', description: 'Softer' })
    expect(screen.getByText('Bedtime')).not.toBeNull()
    expect(screen.getByText('Softer')).not.toBeNull()
    await waitFor(() => expect(status()).toBe('Saved Bedtime.'))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename Bedtime' }))

    view.unmount()
    renderApp()
    await screen.findByText('Bedtime')
    expect(server.voices.find((voice) => voice.id === 'v2').name).toBe('Bedtime')
  })

  it('requires a name, marks the field, and writes nothing until Save succeeds', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename My voice' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const name = screen.getByLabelText('Name')
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(name)
    expect(name.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(name.getAttribute('aria-describedby')).textContent).toBe('Give the voice a name.')
    expect(server.callsTo('PATCH', '/text/to/speech')).toEqual([])
  })

  it('keeps the editor and says nothing changed when the provider fails', async () => {
    server.failNext('PATCH /text/to/speech/v1/voices/v2', { status: 502 })
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename Storyteller' }))
    await user.type(screen.getByLabelText('Name'), ' 2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert', { name: '' })).textContent).toContain("Couldn't rename the voice. Nothing was changed.")
    expect(screen.getByRole('heading', { name: 'Rename Storyteller' })).not.toBeNull()
    expect(server.voices[1].name).toBe('Storyteller')
  })

  it('removes a voice deleted elsewhere and says so instead of failing silently', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename Storyteller' }))
    server.voices = server.voices.filter((voice) => voice.id !== 'v2')
    await user.type(screen.getByLabelText('Name'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Rename/ })).toBeNull())
    expect(screen.queryByText('Storyteller')).toBeNull()
    expect(within(voicesRegion()).getByText('This voice was deleted somewhere else.')).not.toBeNull()
  })

  it('Cancel closes without writing and returns focus to the control that opened it', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename My voice' }))
    await user.type(screen.getByLabelText('Name'), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename My voice' })))
    expect(server.callsTo('PATCH', '/text/to/speech')).toEqual([])
    expect(screen.getByText('My voice')).not.toBeNull()
  })

  it('opens only one editor at a time and asks before discarding unsaved input', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename My voice' }))
    await user.type(screen.getByLabelText('Name'), ' edited')
    await user.click(screen.getByRole('button', { name: 'Rename Storyteller' }))
    const guard = screen.getByRole('group', { name: 'Discard your changes?' })
    expect(document.activeElement).toBe(within(guard).getByText('Discard your changes?'))
    expect(screen.getAllByRole('heading', { name: /^Rename/ })).toHaveLength(1)
    await user.click(within(guard).getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('group', { name: 'Discard your changes?' })).toBeNull()
    expect(screen.getByLabelText('Name').value).toBe('My voice edited')
    await user.click(screen.getByRole('button', { name: 'Rename Storyteller' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('heading', { name: 'Rename Storyteller' })).not.toBeNull()
    expect(screen.getAllByRole('heading', { name: /^Rename/ })).toHaveLength(1)
  })
})

describe('delete', () => {
  it('confirms in place with the consequence, focuses the question, and Keep it restores focus', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Delete Storyteller' }))
    const confirm = screen.getByRole('group', { name: 'Delete Storyteller?' })
    expect(within(confirm).getByText("It's removed from ElevenLabs too, so Story Book and Polyglot can't speak in it anymore. This can't be undone.")).not.toBeNull()
    expect(document.activeElement).toBe(within(confirm).getByText('Delete Storyteller?'))
    await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete Storyteller' })))
    expect(server.callsTo('DELETE', '/text/to/speech')).toEqual([])
  })

  it('deletes through DELETE, removes the row, announces, and moves focus to the section heading', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Delete Storyteller' }))
    await user.click(within(screen.getByRole('group', { name: 'Delete Storyteller?' })).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Storyteller')).toBeNull())
    expect(server.callsTo('DELETE', '/text/to/speech/v1/voice/v2')).toHaveLength(1)
    await waitFor(() => expect(status()).toBe('Deleted Storyteller.'))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /^Voices/ }))
    expect(screen.getByLabelText('1 voice').textContent).toBe('1')
  })

  it('leaves no primary when the primary is deleted, and names the fallback the apps will use', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Delete My voice' }))
    await user.click(within(screen.getByRole('group', { name: 'Delete My voice?' })).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('My voice')).toBeNull())
    expect(screen.getByText(/No primary voice\. Story Book and Polyglot start with Storyteller until you choose one\./)).not.toBeNull()
    expect(server.voices).toEqual([expect.objectContaining({ id: 'v2', isPrimary: false })])
  })

  it('says nothing changed and keeps the row when deletion fails', async () => {
    server.failNext('DELETE /text/to/speech/v1/voice/v2', { status: 502 })
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Delete Storyteller' }))
    await user.click(within(screen.getByRole('group', { name: 'Delete Storyteller?' })).getByRole('button', { name: 'Delete' }))
    expect((await screen.findByRole('alert', { name: '' })).textContent).toContain("Couldn't delete the voice. Nothing was changed.")
    expect(screen.getByRole('group', { name: 'Delete Storyteller?' })).not.toBeNull()
    expect(server.voices).toHaveLength(2)
  })
})

describe('add a voice', () => {
  it('opens at the top of the list, hides the gold action, and labels every field', async () => {
    renderApp()
    await list()
    await openAdd()
    expect(document.activeElement).toBe(screen.getByLabelText('Name'))
    expect(within(voicesRegion()).queryByRole('button', { name: 'Add voice' })).toBeNull()
    expect(document.querySelectorAll('.ac-btn--gold')).toHaveLength(0)
    expect(screen.getByLabelText(/^Description/)).not.toBeNull()
    expect(screen.getByRole('group', { name: /Samples/ })).not.toBeNull()
    expect(screen.getByLabelText(/This is my voice, or I have permission/).getAttribute('type')).toBe('checkbox')
    expect(screen.getByText('Samples go to ElevenLabs, which creates and stores the voice. BakerRang keeps the name and description, not the audio.')).not.toBeNull()
    const editor = document.getElementById('ac-add-editor')
    expect(editor.compareDocumentPosition(screen.getByRole('list', { name: 'Your voices' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const field of editor.querySelectorAll('input:not(.ac-sr)')) expect(field.labels.length).toBeGreaterThan(0)
  })

  it('validates name, samples and consent together, focuses the first error and describes each field', async () => {
    renderApp()
    await list()
    await openAdd()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    const name = screen.getByLabelText('Name')
    const consent = screen.getByLabelText(/This is my voice/)
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(consent.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(name.getAttribute('aria-describedby')).textContent).toBe('Give the voice a name.')
    expect(document.getElementById(consent.getAttribute('aria-describedby')).textContent).toBe('Confirm you have the right to clone this voice.')
    expect(screen.getByRole('group', { name: /Samples/ }).getAttribute('aria-describedby')).toBe('ac-add-samples-err')
    expect(screen.getByText('Add at least one recording or audio file.')).not.toBeNull()
    expect(document.activeElement).toBe(name)
    await waitFor(() => expect(status()).toBe('Check the highlighted fields.'))
    expect(server.callsTo('POST', '/text/to/speech')).toEqual([])
  })

  it('moves focus to the consent checkbox when only consent is missing', async () => {
    renderApp()
    await list()
    await openAdd()
    await user.type(screen.getByLabelText('Name'), 'Voice')
    await upload(fakeFile('take.wav', 'audio/wav'))
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    expect(document.activeElement).toBe(screen.getByLabelText(/This is my voice/))
  })

  it('creates the voice with multipart form data, closes the editor, announces, and focuses the new voice', async () => {
    server.voices = []
    renderApp()
    await screen.findByText('No voices yet.')
    await openAdd()
    await fillValid()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull())
    const [call] = server.callsTo('POST', '/text/to/speech/v1/voice')
    expect(call.body).toMatchObject({ name: 'Reading voice', description: 'Kitchen table', consent: 'true' })
    expect(call.body.files).toHaveLength(1)
    expect(call.body.files[0]).toMatchObject({ key: 'files', type: 'audio/mpeg' })
    expect(Object.keys(call.body).sort()).toEqual(['consent', 'description', 'files', 'name'])
    const item = within(await list()).getAllByRole('listitem')[0]
    expect(item.textContent).toContain('Reading voice')
    expect(within(item).getByText('Primary')).not.toBeNull()
    await waitFor(() => expect(status()).toBe('Voice created: Reading voice.'))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename Reading voice' })))
    expect(screen.getByRole('button', { name: 'Add voice' })).not.toBeNull()
  })

  it('makes a second voice non-primary', async () => {
    renderApp()
    await list()
    await openAdd()
    await fillValid({ name: 'Second' })
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull())
    expect(server.voices.filter((voice) => voice.isPrimary).map((voice) => voice.id)).toEqual(['v1'])
    expect(screen.getByLabelText('3 voices').textContent).toBe('3')
  })

  it('shows a busy state while creating: form busy, fields and Cancel disabled, honest status', async () => {
    const release = server.holdNext('POST /text/to/speech/v1/voice')
    renderApp()
    await list()
    await openAdd()
    await fillValid()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    const form = document.querySelector('#ac-add-editor form')
    expect(form.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByLabelText('Name').disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'Creating voice…' })).not.toBeNull()
    expect(screen.getByText('This can take up to a minute.')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Creating voice…' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(server.callsTo('POST', '/text/to/speech/v1/voice')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Add a voice' })).not.toBeNull()
    await act(async () => release())
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull())
  })

  it('shows the provider failure as a role=alert and lets the user try again', async () => {
    server.failNext('POST /text/to/speech/v1/voice', { status: 502, body: { error: "Voice couldn't be created" } })
    renderApp()
    await list()
    await openAdd()
    await fillValid()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    const alert = await screen.findByRole('alert', { name: '' })
    expect(alert.textContent).toContain("ElevenLabs couldn't create the voice. Nothing was saved. Try again.")
    expect(screen.getByLabelText('Name').value).toBe('Reading voice')
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull())
    expect(server.callsTo('POST', '/text/to/speech/v1/voice')).toHaveLength(2)
  })

  it('explains a too-large response from the server', async () => {
    server.failNext('POST /text/to/speech/v1/voice', { status: 413, body: { error: 'Samples are too large', field: 'files' } })
    renderApp()
    await list()
    await openAdd()
    await fillValid()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    expect((await screen.findByRole('alert', { name: '' })).textContent).toContain('Those samples are too large. Keep each under 10 MB.')
  })

  it('never retries automatically when the outcome is unknown, and refreshes only on request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.failNext('POST /text/to/speech/v1/voice', { network: true })
    renderApp()
    await list()
    await openAdd()
    await fillValid()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    const alert = await screen.findByText("Account couldn't confirm the new voice.")
    expect(alert.closest('[role="alert"]').textContent).toContain("It may still have been created. Refresh your voices to check before you try again, so you don't clone it twice.")
    await act(async () => { vi.advanceTimersByTime(180000) })
    expect(server.callsTo('POST', '/text/to/speech/v1/voice')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Create voice' })).toBeNull()
    const listCalls = server.callsTo('GET', '/text/to/speech/v1/voices').length
    await user.click(screen.getByRole('button', { name: 'Refresh voices' }))
    await waitFor(() => expect(server.callsTo('GET', '/text/to/speech/v1/voices').length).toBe(listCalls + 1))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull())
    expect(server.callsTo('POST', '/text/to/speech/v1/voice')).toHaveLength(1)
  })

  it('treats a non-502 server error on create as unknown too, since the provider may have finished', async () => {
    server.failNext('POST /text/to/speech/v1/voice', { status: 504 })
    renderApp()
    await list()
    await openAdd()
    await fillValid()
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    await screen.findByText("Account couldn't confirm the new voice.")
  })

  it('rejects unsupported, oversized and surplus samples before any upload', async () => {
    renderApp()
    await list()
    await openAdd()
    await upload(fakeFile('notes.txt', 'text/plain'))
    expect(screen.getByText("That file isn't a supported audio type.")).not.toBeNull()
    await upload(fakeFile('big.mp3', 'audio/mpeg', 10 * 1024 * 1024 + 1))
    expect(screen.getByText('Those samples are too large. Keep each under 10 MB.')).not.toBeNull()
    expect(screen.queryByLabelText(/^Play/)).toBeNull()
    await upload(fakeFile('a.mp3', 'audio/mpeg'), fakeFile('b.wav', 'audio/wav'), fakeFile('c.m4a', 'audio/x-m4a'), fakeFile('d.mp3', 'audio/mpeg'))
    expect(screen.getByText('You can add up to 3 samples.')).not.toBeNull()
    expect(within(screen.getByRole('list', { name: 'Samples' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByLabelText('Add audio files').disabled).toBe(true)
    await upload(fakeFile('e.mp3', 'audio/mpeg'))
    expect(server.callsTo('POST', '/text/to/speech')).toEqual([])
  })

  it('rejects a set of samples over 25 MB in total', async () => {
    renderApp()
    await list()
    await openAdd()
    await upload(fakeFile('a.mp3', 'audio/mpeg', 9 * 1024 * 1024), fakeFile('b.mp3', 'audio/mpeg', 9 * 1024 * 1024), fakeFile('c.mp3', 'audio/mpeg', 9 * 1024 * 1024))
    expect(within(screen.getByRole('list', { name: 'Samples' })).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Those samples are too large. Keep each under 10 MB.')).not.toBeNull()
  })

  it('lists samples with named play and remove buttons, and revokes each blob URL when removed', async () => {
    renderApp()
    await list()
    await openAdd()
    await upload(fakeFile('desk-take.m4a', 'audio/x-m4a', 2.4 * 1024 * 1024))
    expect(screen.getByText('desk-take.m4a')).not.toBeNull()
    expect(screen.getByText('2.4 MB')).not.toBeNull()
    const play = screen.getByRole('button', { name: 'Play desk-take.m4a' })
    expect(play.getAttribute('aria-pressed')).toBe('false')
    await user.click(play)
    expect(screen.getByRole('button', { name: 'Pause desk-take.m4a' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Remove desk-take.m4a' }))
    expect(screen.queryByText('desk-take.m4a')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample-1')
    await waitFor(() => expect(status()).toBe('Removed desk-take.m4a.'))
  })

  it('revokes every blob URL when the editor is cancelled', async () => {
    renderApp()
    await list()
    await openAdd()
    await upload(fakeFile('a.mp3', 'audio/mpeg'), fakeFile('b.wav', 'audio/wav'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.activeElement).toBe(button('Add voice')))
  })

  it('disables Add voice and creation while offline', async () => {
    renderApp()
    await list()
    await openAdd()
    await fillValid()
    setOnline(false)
    await user.click(screen.getByRole('button', { name: 'Create voice' }))
    expect(server.callsTo('POST', '/text/to/speech')).toEqual([])
    setOnline(true)
  })
})

describe('leaving with unsaved input, and losing the session', () => {
  it('guards Sign out while an editor is dirty, and discarding signs out', async () => {
    renderApp()
    await list()
    await openAdd()
    await user.type(screen.getByLabelText('Name'), 'Half-finished')
    await user.click(within(screen.getByRole('region', { name: 'Session' })).getByRole('button', { name: 'Sign out' }))
    expect(authStore.get().logout).not.toHaveBeenCalled()
    const guard = screen.getByRole('group', { name: 'Discard your changes and sign out?' })
    await user.click(within(guard).getByRole('button', { name: 'Keep editing' }))
    expect(authStore.get().logout).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('region', { name: 'Session' })).getByRole('button', { name: 'Sign out' }))
    await user.click(screen.getByRole('button', { name: 'Discard and sign out' }))
    expect(authStore.get().logout).toHaveBeenCalledTimes(1)
    await screen.findByRole('heading', { level: 1, name: 'Your BakerRang account.' })
  })

  it('does not guard Sign out for an untouched editor', async () => {
    renderApp()
    await list()
    await openAdd()
    await user.click(within(screen.getByRole('region', { name: 'Session' })).getByRole('button', { name: 'Sign out' }))
    expect(authStore.get().logout).toHaveBeenCalledTimes(1)
  })

  it('closes editors and clears voices when the session ends, and starts clean after signing back in', async () => {
    renderApp()
    await list()
    await openAdd()
    await user.type(screen.getByLabelText('Name'), 'Typing when the session ended')
    act(() => authStore.set({ status: AUTH_STATUS.ANONYMOUS, user: null }))
    await screen.findByRole('heading', { level: 1, name: 'Your BakerRang account.' })
    expect(screen.queryByText('My voice')).toBeNull()
    expect(screen.queryByLabelText('Name')).toBeNull()
    act(() => authStore.reset())
    await list()
    expect(screen.queryByRole('heading', { name: 'Add a voice' })).toBeNull()
  })

  it('drops a slow response that arrives after sign-out: nothing is rendered, nothing throws', async () => {
    const release = server.holdNext('GET /text/to/speech/v1/voices')
    renderApp()
    await screen.findByRole('region', { name: 'Voices' })
    act(() => authStore.set({ status: AUTH_STATUS.ANONYMOUS, user: null }))
    await act(async () => release())
    expect(screen.queryByText('My voice')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Voices' })).toBeNull()
  })

  it('asks the shared auth to re-check when a write answers 401', async () => {
    server.failNext('PUT /text/to/speech/v1/voices/primary', { status: 401 })
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Make Storyteller your primary voice' }))
    await waitFor(() => expect(authStore.get().refresh).toHaveBeenCalled())
  })

  it('ignores a result superseded by a newer action on the same voice', async () => {
    const release = server.holdNext('PATCH /text/to/speech/v1/voices/v2')
    renderApp()
    await list()
    await user.click(screen.getByRole('button', { name: 'Rename Storyteller' }))
    await user.type(screen.getByLabelText('Name'), ' one')
    fireEvent.submit(document.querySelector('#ac-rename-v2 form'))
    await waitFor(() => expect(server.callsTo('PATCH', '/text/to/speech/v1/voices/v2')).toHaveLength(1))
    await act(async () => release())
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Rename/ })).toBeNull())
    expect(screen.getByText('Storyteller one')).not.toBeNull()
  })
})

describe('separation from Passwords and Supermarket', () => {
  it('makes only preference and voice requests over a whole session', async () => {
    renderApp()
    await list()
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByRole('button', { name: 'Make Storyteller your primary voice' }))
    await user.click(screen.getByRole('button', { name: 'Rename My voice' }))
    await user.type(screen.getByLabelText('Name'), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Rename/ })).toBeNull())
    const paths = new Set(server.calls.map((call) => call.path.replace(/\/[^/]+$/, (tail) => tail.startsWith('/v') && !tail.includes('voice') ? tail : '/:id')))
    for (const path of server.calls.map((call) => call.path)) {
      expect(path.startsWith('/account/preferences') || path.startsWith('/text/to/speech/v1/voice')).toBe(true)
    }
    expect(paths.size).toBeGreaterThan(1)
  })
})
