/* eslint-disable react/jsx-indent, react/jsx-closing-tag-location */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@bakerrang/web-ui'
import { createBill, createPayday, deleteBill, deletePayday, updateBill, updatePayday } from '../api/budget.js'
import { localToday, isoDate } from '../plan/dates.js'
import { scheduleLabel } from '../plan/format.js'
import { formatCents, parseMoney } from '../plan/money.js'
import { AlertIcon, CloudIcon, InfoIcon, OfflineIcon } from '../Icons.jsx'
import { DayRule } from './DayRule.jsx'
import { FieldError } from './FieldError.jsx'
import { Listbox } from './Listbox.jsx'
import { MoneyInput } from './MoneyInput.jsx'

const amountText = (value) => Number.isInteger(value) ? formatCents(value).replace('$', '').replace('−', '-') : ''
const uuid = () => globalThis.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`
export const safePaymentUrl = (value) => {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 1000) return null
  try { const url = new URL(value.trim()); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : null } catch { return null }
}

const seed = (kind, entry) => {
  if (kind === 'payday') return entry ? { ...entry, amount: amountText(entry.amountCents) } : { name: '', amount: '', schedule: { frequency: 'monthly', rule: 'day', day: 1 }, requestId: uuid() }
  const category = kind === 'bill' ? 'utility' : kind === 'one-off' ? 'one-time' : kind
  return entry
    ? { ...entry, amount: amountText(entry.amountCents), balance: amountText(entry.balanceCents), endMonth: entry.lastPaymentMonth?.slice(5) || null, endYear: entry.lastPaymentMonth?.slice(0, 4) || '' }
    : { category, name: '', amount: '', due: category === 'one-time' ? { rule: 'date', date: isoDate(localToday()) } : { rule: 'day', day: 1 }, paydayId: null, autoPay: false, active: true, notes: '', url: '', lastPaymentMonth: null, endMonth: null, endYear: '', balance: '', requestId: uuid() }
}

// requestId is minted per seed, so it must not count toward "dirty".
const comparable = ({ requestId, ...fields }) => JSON.stringify(fields)
const LABELS = { payday: 'payday', bill: 'bill', debt: 'debt', 'one-off': 'one-off' }
const PLACEHOLDERS = { payday: 'e.g. Acme payroll', bill: 'e.g. Rent', debt: 'e.g. Car loan', 'one-off': 'e.g. Car registration' }
const introFor = (kind, isNew) => kind === 'payday'
  ? (isNew ? 'New payday. It appears in every month it falls in.' : 'Changes apply to every month.')
  : kind === 'one-off'
    ? (isNew ? 'New one-off. It appears in the month it is due.' : 'A one-off bill, due once.')
    : (isNew ? `New ${kind}. It repeats every month.` : 'Changes apply to every month.')
const paydayOptions = (paydays) => [{ value: null, label: 'Automatic', description: 'The most recent payday on or before the due date' }, ...paydays.map((payday) => ({ value: payday.id, label: payday.name || '(unnamed)', description: scheduleLabel(payday) }))]
const monthOptions = [{ value: null, label: 'No end' }, ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label }))]
const MESSAGE_ICONS = { invalid: AlertIcon, failed: CloudIcon, offline: OfflineIcon, info: InfoIcon }

export const EntryEditor = ({ kind, entry, paydays, bills = [], online, onSaved, onDeleted, onClose, onDirtyChange, discardPrompt, onDiscard, onKeepEditing }) => {
  const [draft, setDraft] = useState(() => seed(kind, entry)); const [errors, setErrors] = useState({}); const [status, setStatus] = useState('idle'); const [message, setMessage] = useState(null); const [confirmDelete, setConfirmDelete] = useState(false); const [conflict, setConflict] = useState(null)
  const first = useRef(null); const controller = useRef(null)
  const original = useMemo(() => comparable(seed(kind, entry)), [entry, kind]); const dirty = comparable(draft) !== original
  useEffect(() => { first.current?.focus(); return () => controller.current?.abort() }, [])
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => { const before = (event) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before) }, [dirty])
  const patch = (value) => setDraft((current) => ({ ...current, ...value }))
  const close = () => onClose()
  const payday = kind === 'payday'
  const oneOff = draft.category === 'one-time'
  const lastPaymentMonth = draft.category === 'debt' && draft.endMonth ? `${draft.endYear.trim()}-${draft.endMonth}` : null
  const validate = () => {
    const next = {}; const amountCents = parseMoney(draft.amount)
    if (!draft.name.trim()) next.name = true
    if (amountCents === null) next.amount = true
    if (payday) {
      if (draft.schedule.frequency === 'monthly' && draft.schedule.rule === 'day' && (!Number.isInteger(draft.schedule.day) || draft.schedule.day < 1 || draft.schedule.day > 31)) next.schedule = true
      if (draft.schedule.frequency !== 'monthly' && !draft.schedule.anchorDate) next.anchorDate = true
    } else if (oneOff) {
      if (!draft.due.date) next.due = true
    } else if (draft.due.rule === 'day' && (!Number.isInteger(draft.due.day) || draft.due.day < 1 || draft.due.day > 31)) next.due = true
    if (draft.category === 'debt' && lastPaymentMonth && !/^(?:20\d{2}|2100)-(?:0[1-9]|1[0-2])$/.test(lastPaymentMonth)) next.lastPaymentMonth = true
    if (draft.category === 'debt' && draft.balance && parseMoney(draft.balance) === null) next.balance = true
    if (draft.url && !safePaymentUrl(draft.url)) next.url = true
    setErrors(next)
    const firstKey = Object.keys(next)[0]
    const focusId = firstKey === 'schedule' || (firstKey === 'due' && !oneOff) ? 'bd-day' : `bd-${firstKey}`
    if (firstKey) document.getElementById(focusId)?.focus()
    return { ok: !firstKey, amountCents, errorCount: Object.keys(next).length }
  }
  const body = (amountCents) => payday
    ? { name: draft.name, amountCents, schedule: draft.schedule }
    : { category: draft.category, name: draft.name, amountCents, due: draft.due, paydayId: draft.paydayId, autoPay: draft.autoPay, active: draft.active, notes: draft.notes, url: draft.url, lastPaymentMonth, balanceCents: draft.category === 'debt' && draft.balance ? parseMoney(draft.balance) : null }
  const submit = async (event) => {
    event.preventDefault(); if (!online || status === 'saving' || conflict) return
    const result = validate(); if (!result.ok) { setMessage({ kind: 'invalid', title: `Check the ${result.errorCount} field${result.errorCount === 1 ? '' : 's'} marked above.` }); return }
    setStatus('saving'); setMessage(null); setConflict(null); controller.current = new AbortController()
    const payload = body(result.amountCents)
    try {
      const response = entry
        ? payday ? await updatePayday(entry.id, { ...payload, expectedRev: entry.rev }, { signal: controller.current.signal }) : await updateBill(entry.id, { ...payload, expectedRev: entry.rev }, { signal: controller.current.signal })
        : payday ? await createPayday({ ...payload, requestId: draft.requestId }, { signal: controller.current.signal }) : await createBill({ ...payload, requestId: draft.requestId }, { signal: controller.current.signal })
      onSaved(payday ? response.payday : response.bill, entry ? 'Saved' : 'Added')
    } catch (error) {
      setStatus('idle')
      if (error.status === 409 && error.code === 'conflict') {
        const sameAsDraft = error.current && Object.entries(payload).every(([field, value]) => JSON.stringify(error.current[field]) === JSON.stringify(value))
        if (sameAsDraft) { onSaved(error.current, entry ? 'Saved' : 'Added'); return }
        setConflict(error.current); setMessage({ kind: 'info', title: `${draft.name || 'This entry'} was changed somewhere else.`, detail: 'Use the latest to see it, then edit again.' })
      } else if (error.status === 404) setMessage({ kind: 'info', title: `${draft.name || 'This entry'} was deleted somewhere else.` })
      else if (error.code === 'limit') setMessage({ kind: 'info', title: `You have ${error.limit} ${payday ? 'paydays' : 'bills'}, which is the most Budget keeps.`, detail: 'Delete one to add another.' })
      else setMessage({ kind: 'failed', title: "Couldn't save.", detail: 'Your changes are still here. Try again.' })
    }
  }
  const remove = async () => {
    if (!entry || !online || status === 'saving') return
    setStatus('saving')
    try { const result = payday ? await deletePayday(entry.id) : await deleteBill(entry.id); onDeleted(result) } catch { setStatus('idle'); setConfirmDelete(false); setMessage({ kind: 'failed', title: "Couldn't delete this entry.", detail: 'Nothing was changed.' }) }
  }
  const useLatest = () => { setDraft(seed(kind, conflict)); setConflict(null); setErrors({}); setMessage({ kind: 'info', title: 'Loaded the latest version.' }) }
  const disabled = status === 'saving' || !online
  const chooseFrequency = (frequency) => patch({ schedule: frequency === 'monthly' ? { frequency, rule: 'day', day: 1 } : { frequency, anchorDate: isoDate(localToday()) } })
  const onFrequencyKeyDown = (event) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('[role="radio"]')]; const current = buttons.indexOf(event.target)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : buttons.length - 1)) % buttons.length
    chooseFrequency(buttons[next].dataset.frequency); buttons[next].focus()
  }
  const name = draft.name.trim() || `this ${LABELS[kind]}`
  const pinnedCount = payday && entry ? bills.filter((bill) => bill.paydayId === entry.id).length : 0
  const deleteDetail = `${payday ? `It leaves every month.${pinnedCount ? ` ${pinnedCount} bill${pinnedCount === 1 ? '' : 's'} paid from it go${pinnedCount === 1 ? 'es' : ''} back to automatic.` : ''}` : oneOff ? 'It is removed from your plan.' : 'It leaves every month.'} This can't be undone.`
  const shown = status === 'saving' ? { kind: 'saving', title: 'Saving…' } : message || (!online ? { kind: 'offline', title: 'Offline. Saving is paused.' } : null)
  const MessageIcon = shown && MESSAGE_ICONS[shown.kind]
  const opt = <em className='bd-opt'> (optional)</em>
  return (
    <form className='bd-editor' noValidate aria-label={`${entry ? 'Edit' : 'Add'} ${draft.name || LABELS[kind]}`} aria-busy={status === 'saving'} onSubmit={submit} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }}>
      <p className='bd-editor__intro'>{introFor(kind, !entry)}</p>
      <div className='bd-editor__grid'>
        <label className='bd-field bd-field--s4' htmlFor='bd-name'><span>Name</span><input ref={first} id='bd-name' autoComplete='off' value={draft.name} aria-invalid={errors.name || undefined} placeholder={PLACEHOLDERS[kind]} onChange={(event) => patch({ name: event.target.value })} />{errors.name && <FieldError>Give it a name.</FieldError>}</label>
        <MoneyInput id='bd-amount' className='bd-field--s2' label={payday ? 'Take-home pay' : 'Amount'} value={draft.amount} invalid={errors.amount} onChange={(amount) => patch({ amount })} />
        {payday && <>
          <fieldset className='bd-field bd-field--wide'><legend>Repeats</legend><div className='bd-inline'><div className='bd-segments' role='radiogroup' aria-label='Repeats' onKeyDown={onFrequencyKeyDown}>{[['monthly', 'Monthly'], ['biweekly', 'Every 2 weeks'], ['weekly', 'Every week']].map(([frequency, label]) => <button type='button' role='radio' aria-checked={draft.schedule.frequency === frequency} tabIndex={draft.schedule.frequency === frequency ? 0 : -1} data-frequency={frequency} key={frequency} onClick={() => chooseFrequency(frequency)}>{label}</button>)}</div></div></fieldset>
          {draft.schedule.frequency === 'monthly'
            ? <DayRule label='Paid on' value={draft.schedule} invalid={errors.schedule} hint='Days past the end of a short month land on its last day.' onChange={(rule) => patch({ schedule: { frequency: 'monthly', ...rule } })} />
            : <label className='bd-field' htmlFor='bd-anchorDate'><span>A payday date</span><input id='bd-anchorDate' type='date' value={draft.schedule.anchorDate || ''} aria-invalid={errors.anchorDate || undefined} onChange={(event) => patch({ schedule: { ...draft.schedule, anchorDate: event.target.value } })} />{errors.anchorDate && <FieldError>Pick a payday date.</FieldError>}<small className='bd-hint-text'>Any past or upcoming payday. Budget counts {draft.schedule.frequency === 'weekly' ? 'weeks' : 'two-week steps'} forward and back from it.</small></label>}
        </>}
        {!payday && (oneOff
          ? <label className='bd-field bd-field--s2' htmlFor='bd-due'><span>Due date</span><input id='bd-due' type='date' value={draft.due.date || ''} aria-invalid={errors.due || undefined} onChange={(event) => patch({ due: { rule: 'date', date: event.target.value } })} />{errors.due && <FieldError>Pick the date it is due.</FieldError>}</label>
          : <DayRule value={draft.due} invalid={errors.due} onChange={(due) => patch({ due })} />)}
        {draft.category === 'debt' && <>
          <fieldset className='bd-field'><legend>Last payment{opt}</legend><div className='bd-inline bd-inline--nowrap'><Listbox label='Last payment month' hideLabel value={draft.endMonth} options={monthOptions} onChange={(endMonth) => patch({ endMonth, endYear: endMonth && !draft.endYear ? isoDate(localToday()).slice(0, 4) : draft.endYear })} /><input id='bd-lastPaymentMonth' className='bd-year-input' inputMode='numeric' autoComplete='off' placeholder='Year' aria-label='Last payment year' value={draft.endYear} aria-invalid={errors.lastPaymentMonth || undefined} onChange={(event) => patch({ endYear: event.target.value.replace(/\D/g, '').slice(0, 4) })} /></div>{errors.lastPaymentMonth && <FieldError>Enter the year of the last payment, like 2027.</FieldError>}</fieldset>
          <MoneyInput id='bd-balance' label='Balance you noted' optional hint="For your reference. Budget doesn't change it." value={draft.balance} invalid={errors.balance} onChange={(balance) => patch({ balance })} />
        </>}
        {!payday && <>
          <Listbox className={oneOff ? 'bd-field--s4' : ''} label='Paid from' value={draft.paydayId} options={paydayOptions(paydays)} onChange={(paydayId) => patch({ paydayId })} />
          <div className={`bd-field bd-checks ${oneOff ? 'bd-field--wide' : ''}`}><label className='bd-check'><input type='checkbox' checked={draft.autoPay} onChange={(event) => patch({ autoPay: event.target.checked })} /><span>Auto-pay</span></label>{(!oneOff || !draft.active) && <label className='bd-check'><input type='checkbox' checked={!draft.active} onChange={(event) => patch({ active: !event.target.checked })} /><span>Paused<small>Left out of every month</small></span></label>}</div>
          <label className='bd-field' htmlFor='bd-url'><span>Payment link{opt}</span><input id='bd-url' type='url' inputMode='url' autoComplete='off' placeholder='https://' value={draft.url} aria-invalid={errors.url || undefined} onChange={(event) => patch({ url: event.target.value })} />{errors.url && <FieldError>Use a full link that starts with https://</FieldError>}{entry && safePaymentUrl(draft.url) && <a className='bd-hint' href={safePaymentUrl(draft.url)} target='_blank' rel='noopener noreferrer'>Open payment site</a>}</label>
          <label className='bd-field' htmlFor='bd-notes'><span>Notes{opt}</span><input id='bd-notes' maxLength='300' autoComplete='off' value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
        </>}
      </div>
      {discardPrompt && <div className='bd-discard' role='alert'><p><strong>Discard these changes?</strong><small>Your edits have not been saved.</small></p><Button type='button' variant='ghost' onClick={onKeepEditing}>Keep editing</Button><Button type='button' className='bd-btn--danger' onClick={onDiscard}>Discard</Button></div>}
      <footer className='bd-editor__foot'>
        {confirmDelete
          ? <div className='bd-confirm' role='group' aria-label='Confirm delete'><p><strong>Delete {name}?</strong><small>{deleteDetail}</small></p><Button type='button' variant='ghost' onClick={() => setConfirmDelete(false)}>Keep it</Button><Button type='button' className='bd-btn--danger' aria-disabled={disabled} disabled={disabled} onClick={remove}>Delete</Button></div>
          : <>
            {entry && <Button type='button' className='bd-btn--danger' aria-disabled={disabled} disabled={disabled} onClick={() => { setMessage(null); setConfirmDelete(true) }}>Delete</Button>}
            {shown
              ? <div className='bd-editor__msg' role={shown.kind === 'saving' ? 'status' : 'alert'}>{shown.kind === 'saving' ? <span className='bd-spinner' aria-hidden='true' /> : MessageIcon && <MessageIcon />}<span><b>{shown.title}</b>{shown.detail && <small>{shown.detail}</small>}</span></div>
              : <span className='bd-editor__spacer' />}
            <Button type='button' variant='quiet' onClick={close}>Cancel</Button>
            {conflict
              ? <Button type='button' className='bd-btn--ink' onClick={useLatest}>Use latest</Button>
              : <Button type='submit' className='bd-btn--ink' aria-disabled={disabled} disabled={disabled}>{status === 'saving' ? 'Saving…' : entry ? 'Save' : `Add ${LABELS[kind]}`}</Button>}
          </>}
      </footer>
    </form>
  )
}
