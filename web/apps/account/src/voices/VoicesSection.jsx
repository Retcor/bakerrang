/* eslint-disable react/jsx-handler-names */
import React, { useEffect, useRef, useState } from 'react'
import { useAnnounce } from '../announce.jsx'
import { Icon } from '../Icons.jsx'
import { AddVoiceEditor } from './AddVoiceEditor.jsx'
import { DeleteConfirm } from './DeleteConfirm.jsx'
import { RenameEditor } from './RenameEditor.jsx'

const DELETED_ELSEWHERE = 'This voice was deleted somewhere else.'

const VoiceRow = ({ voice, busy, problem, onPrimary, onRename, onDelete }) => {
  const working = Boolean(busy)
  const guarded = (handler) => () => { if (!working) handler() }
  return (
    <li className='ac-voice' aria-busy={working || undefined}>
      <div>
        <div className='ac-voice__name'>
          <span>{voice.name}</span>
          {voice.isPrimary && <span className='ac-tag'>Primary</span>}
        </div>
        {voice.description && <p className='ac-voice__desc'>{voice.description}</p>}
      </div>
      <div className='ac-voice__acts'>
        {!voice.isPrimary && <button type='button' className='ac-btn ac-btn--quiet ac-btn--sm' aria-label={`Make ${voice.name} your primary voice`} aria-disabled={working || undefined} onClick={guarded(onPrimary)}>{busy === 'primary' ? <span className='ac-spin' aria-hidden='true' /> : null}Make primary</button>}
        <button type='button' className='ac-btn ac-btn--quiet ac-btn--sm' data-focus={`rename:${voice.id}`} aria-label={`Rename ${voice.name}`} aria-disabled={working || undefined} onClick={guarded(onRename)}>Rename</button>
        <button type='button' className='ac-btn ac-btn--danger ac-btn--sm' data-focus={`delete:${voice.id}`} aria-label={`Delete ${voice.name}`} aria-disabled={working || undefined} onClick={guarded(onDelete)}>Delete</button>
      </div>
      {problem && <p className='ac-voice__note' role='alert'><Icon name='alert' />{problem}</p>}
    </li>
  )
}

// Voices: list, add, rename, make primary, delete (docs/apps/PhaseH-Account.md §7, §15).
// Editing is in place and one editor at a time; the editor state lives in the sheet so Sign out
// can guard a dirty editor. `model` is the useVoices result.
export const VoicesSection = ({ model, editor, editorApi, online }) => {
  const announce = useAnnounce()
  const sectionRef = useRef(null)
  const pendingFocus = useRef(null)
  const [focusTick, setFocusTick] = useState(0)
  const [note, setNote] = useState('')
  const [rowProblem, setRowProblem] = useState(null)

  const queueFocus = (target) => { pendingFocus.current = target; setFocusTick((tick) => tick + 1) }
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    const element = target === 'heading' ? sectionRef.current?.querySelector('#ac-h-voices') : sectionRef.current?.querySelector(`[data-focus="${target}"]`)
    if (element) {
      element.focus()
      pendingFocus.current = null
    }
  }, [focusTick, model.voices, editor])

  const { status, voices, busy } = model
  const ready = status === 'ready'
  const addOpen = editor?.kind === 'add'
  const guardFor = (kind) => editorApi.guard && editor?.kind === kind ? editorApi.guard : null

  const openAdd = () => {
    if (!online) return
    setNote('')
    setRowProblem(null)
    editorApi.request({ kind: 'add' })
  }

  const makePrimary = async (voice) => {
    setNote('')
    setRowProblem(null)
    const result = await model.makePrimary(voice.id)
    if (result.ok) {
      announce(`${voice.name} is now your primary voice.`)
      queueFocus(`rename:${voice.id}`)
    } else if (result.kind === 'not_found') {
      setNote(DELETED_ELSEWHERE)
      announce(DELETED_ELSEWHERE)
    } else if (result.kind !== 'stale') {
      setRowProblem({ id: voice.id, text: "Couldn't change your primary voice. Nothing was changed." })
    }
  }

  const saveRename = async (voice, fields) => {
    const result = await model.rename(voice.id, fields)
    if (result.ok) {
      editorApi.close()
      announce(`Saved ${result.result.name}.`)
      queueFocus(`rename:${voice.id}`)
    } else if (result.kind === 'not_found') {
      editorApi.close()
      setNote(DELETED_ELSEWHERE)
      announce(DELETED_ELSEWHERE)
      queueFocus('heading')
    }
    return result
  }

  const deleteVoice = async (voice) => {
    const result = await model.remove(voice.id)
    if (result.ok) {
      editorApi.close()
      announce(`Deleted ${voice.name}.`)
      queueFocus('heading')
    } else if (result.kind === 'not_found') {
      editorApi.close()
      setNote(DELETED_ELSEWHERE)
      announce(DELETED_ELSEWHERE)
      queueFocus('heading')
    }
    return result
  }

  const created = (voice) => {
    editorApi.close()
    announce(`Voice created: ${voice.name}.`)
    queueFocus(`rename:${voice.id}`)
  }

  const refreshAfterUnknown = () => {
    editorApi.close()
    model.load()
    queueFocus('heading')
  }

  const hasPrimary = voices.some((voice) => voice.isPrimary)
  const addEditor = addOpen && (
    <AddVoiceEditor online={online} onCreate={model.create} onCreated={created} onRefresh={refreshAfterUnknown} onDirtyChange={editorApi.setDirty} onCancel={() => { editorApi.close(); queueFocus('add') }} guard={guardFor('add')} />
  )

  let body
  if (status === 'loading') {
    body = (
      <>
        <div className='ac-skel' aria-hidden='true'><i /><i /></div>
        <div className='ac-skel' aria-hidden='true'><i /><i /></div>
        <p className='ac-sr'>Loading your voices…</p>
      </>
    )
  } else if (status === 'error') {
    body = (
      <div className='ac-problem' role='alert'>
        <Icon name='alert' />
        <strong>Account couldn't load your voices.</strong>
        <p>Nothing was changed. Check your connection, then try again.</p>
        <button type='button' className='ac-btn ac-btn--ghost' onClick={() => model.load()}>Try again</button>
      </div>
    )
  } else if (voices.length === 0) {
    body = addEditor || <div className='ac-empty'><strong>No voices yet.</strong><p>Clone your voice from a short recording, and Story Book and Polyglot can read aloud in it.</p></div>
  } else {
    body = (
      <>
        {addEditor}
        <ul className='ac-voices' aria-label='Your voices'>
          {voices.map((voice) => {
            if (editor?.kind === 'delete' && editor.id === voice.id) {
              return <DeleteConfirm key={voice.id} voice={voice} deleting={busy[voice.id] === 'delete'} online={online} onKeep={() => { editorApi.close(); queueFocus(`delete:${voice.id}`) }} onDelete={() => deleteVoice(voice)} />
            }
            if (editor?.kind === 'rename' && editor.id === voice.id) {
              return <RenameEditor key={voice.id} voice={voice} saving={busy[voice.id] === 'rename'} online={online} onSave={(fields) => saveRename(voice, fields)} onCancel={() => { editorApi.close(); queueFocus(`rename:${voice.id}`) }} onDirtyChange={editorApi.setDirty} guard={guardFor('rename')} />
            }
            return (
              <VoiceRow
                key={voice.id}
                voice={voice}
                busy={busy[voice.id]}
                problem={rowProblem?.id === voice.id ? rowProblem.text : ''}
                onPrimary={() => makePrimary(voice)}
                onRename={() => { setNote(''); setRowProblem(null); editorApi.request({ kind: 'rename', id: voice.id }) }}
                onDelete={() => { setNote(''); setRowProblem(null); editorApi.request({ kind: 'delete', id: voice.id }) }}
              />
            )
          })}
        </ul>
        {!hasPrimary && <p className='ac-nopri'><Icon name='info' /><span>No primary voice. Story Book and Polyglot start with {voices[0].name} until you choose one.</span></p>}
      </>
    )
  }

  return (
    <section className='ac-sec' id='voices' aria-labelledby='ac-h-voices' ref={sectionRef}>
      <div className='ac-sec__head'>
        <h2 id='ac-h-voices' tabIndex={-1}>Voices</h2>
        {ready && <span className='ac-sec__count' aria-label={`${voices.length} voice${voices.length === 1 ? '' : 's'}`}>{voices.length}</span>}
        {ready && !addOpen && <button type='button' className='ac-btn ac-btn--gold' data-focus='add' aria-disabled={!online || undefined} onClick={openAdd}><Icon name='plus' />Add voice</button>}
      </div>
      <p className='ac-sec__lead'>Story Book and Polyglot can read aloud in a voice you clone here. They start with your primary voice unless you pick another on that device.</p>
      {note && <p className='ac-note' role='status' style={{ marginTop: 10 }}><Icon name='info' /><span>{note}</span></p>}
      {body}
    </section>
  )
}
