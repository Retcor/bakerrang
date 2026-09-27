/* eslint-disable react/jsx-closing-tag-location */
import React from 'react'
import { formatCents, scheduleLabel } from '../plan/format.js'
import { EntryEditor } from '../editor/EntryEditor.jsx'
import { PlusIcon } from '../Icons.jsx'

const sectionKind = (baseKind, title) => baseKind === 'payday' ? 'payday' : title === 'Bills' ? 'bill' : title === 'Debts' ? 'debt' : 'one-off'
const kindOf = (entry, base) => base === 'payday' ? 'payday' : entry.category === 'utility' ? 'bill' : entry.category === 'one-time' ? 'one-off' : 'debt'
const billSchedule = (entry) => entry.due?.rule === 'date' ? `Due ${entry.due.date}` : entry.due?.rule === 'first' ? 'First day of each month' : entry.due?.rule === 'last' ? 'Last day of each month' : entry.due ? `Day ${entry.due.day} each month` : 'Needs a due day'

export const PlanTable = ({ title, baseKind, entries, editor, editorProps, onOpen, onAdd, monthlyTotal }) => <section className='bd-plan-section'>
  <header><h2>{title}</h2>{monthlyTotal !== null && <p><span>Each month</span><b>{formatCents(monthlyTotal)}</b></p>}</header>
  <table className='bd-plan-table'><caption className='bd-sr'>{title} in your plan</caption><thead><tr><th>Name</th><th>Schedule</th><th>Amount</th></tr></thead><tbody>
    {editor?.entry === null && editor.kind === sectionKind(baseKind, title) && <tr className='bd-editor-row'><td colSpan='3'><EntryEditor {...editorProps} kind={editor.kind} entry={null} /></td></tr>}
    {entries.map((entry) => { const active = editor?.entry?.id === entry.id; const kind = kindOf(entry, baseKind); return <React.Fragment key={entry.id}><tr className={active ? 'is-open' : undefined}><th scope='row'><button type='button' aria-expanded={active} aria-controls={active ? `editor-${entry.id}` : undefined} onClick={() => onOpen(kind, entry)}>{entry.name || '(unnamed)'}</button><span className='bd-tags'>{kind !== 'bill' && <b>{kind}</b>}{entry.autoPay && <b>Auto-pay</b>}{entry.active === false && <b>Paused</b>}{entry.issues?.map((issue) => <b key={issue}>{issue === 'due' ? 'Needs a due day' : issue === 'negative' ? 'Negative amount' : `Needs ${issue}`}</b>)}</span><span className='bd-plan-mobile-schedule' aria-hidden='true'>{baseKind === 'payday' ? scheduleLabel(entry) : billSchedule(entry)}</span></th><td>{baseKind === 'payday' ? scheduleLabel(entry) : billSchedule(entry)}</td><td className='bd-money'>{formatCents(entry.amountCents)}</td></tr>{active && <tr className='bd-editor-row'><td id={`editor-${entry.id}`} colSpan='3'><EntryEditor {...editorProps} kind={kind} entry={entry} /></td></tr>}</React.Fragment> })}
    <tr className='bd-plan-add'><td colSpan='3'><button type='button' onClick={() => onAdd(sectionKind(baseKind, title))}><PlusIcon />Add a {baseKind === 'payday' ? 'payday' : title.slice(0, -1).toLowerCase()}</button></td></tr>
  </tbody>
  </table>
</section>
