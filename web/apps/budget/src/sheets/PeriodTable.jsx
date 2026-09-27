/* eslint-disable react/jsx-indent, react/jsx-closing-tag-location */
import React from 'react'
import { EntryEditor } from '../editor/EntryEditor.jsx'
import { DownArrowIcon } from '../Icons.jsx'
import { civilFromDays } from '../plan/dates.js'
import { bandDate, dueDate, formatCents, monthName, shortDate } from '../plan/format.js'

const Tags = ({ occurrence }) => <span className='bd-tags'>{occurrence.bill.category === 'debt' && <b>Debt</b>}{occurrence.bill.category === 'one-time' && <b>One-off</b>}{occurrence.bill.autoPay && <b>Auto-pay</b>}{occurrence.pinned && <b>Paid from {occurrence.paydayName || 'payday'}</b>}{!occurrence.bill.active && <b>Paused</b>}</span>
const TodayRow = ({ day }) => <tr className='bd-today'><td colSpan='3'>Today · {bandDate(day)}</td></tr>

export const periodLine = (period) => {
  let line = period.end === null ? `Pay period from ${shortDate(period.day)}` : `Pay period ${shortDate(period.day)} – ${shortDate(period.end)}`
  if (period.carried) line += ` · started in ${monthName(civilFromDays(period.day).month)}`
  if (period.later) line += ` · ${period.later} bill${period.later === 1 ? '' : 's'} due later ${period.later === 1 ? 'is' : 'are'} paid from here`
  return line
}

export const PeriodTable = ({ period, editor, editorProps, onEdit, refoot }) => {
  const line = periodLine(period)
  const caption = `Bills paid from the ${bandDate(period.day)} ${period.payday.name} paycheck. ${line.replaceAll(' · ', '. ')}.`
  const animate = Boolean(refoot?.active && (refoot.id === period.payday.id || period.bills.some(({ bill }) => bill.id === refoot.id)))
  const figure = (value, key) => <span key={`${refoot?.nonce || 0}-${key}`} className={`bd-fig ${animate ? 'is-refooting' : ''}`}>{formatCents(value)}</span>
  const rows = []; let todayDone = false
  for (const occurrence of period.bills) {
    if (period.today !== null && !todayDone && occurrence.day > period.today) { rows.push(<TodayRow key={`today-${period.id}`} day={period.today} />); todayDone = true }
    const due = dueDate(occurrence.day); const active = editor?.entry?.id === occurrence.bill.id
    rows.push(<React.Fragment key={`${occurrence.bill.id}@${occurrence.day}`}><tr className={!occurrence.inMonth ? 'is-outside' : ''}><td className='bd-due'><small>{due.weekday}</small><time>{due.date}</time></td><th scope='row'><button type='button' aria-expanded={active} onClick={() => onEdit?.('bill', occurrence.bill)}>{occurrence.bill.name || '(unnamed)'}</button>{occurrence.afterWindow && <span className='bd-sr'>, due after this pay period</span>}<Tags occurrence={{ ...occurrence, paydayName: period.payday.name }} /></th><td className='bd-money'>{formatCents(occurrence.bill.amountCents)}</td></tr>{active && <tr className='bd-editor-row'><td colSpan='3'><EntryEditor {...editorProps} kind={editor.kind} entry={occurrence.bill} /></td></tr>}</React.Fragment>)
  }
  if (period.today !== null && !todayDone) rows.push(<TodayRow key={`today-${period.id}`} day={period.today} />)
  return (
    <section className='bd-period' aria-labelledby={`period-${period.id}`}>
      <h2 id={`period-${period.id}`} className='bd-payband'><span>Paycheck</span><time>{bandDate(period.day)}</time><strong>{period.payday.name || '(unnamed)'}</strong><b>{figure(period.payday.amountCents, 'payday')}</b></h2>
      <p className='bd-period__line'>{line}</p>
      <table className='bd-ledger'><caption className='bd-sr'>{caption}</caption><thead className='bd-sr'><tr><th>Due</th><th>Bill</th><th>Amount</th></tr></thead><tbody>
        {period.bills.length === 0 && <tr><td colSpan='3' className='bd-empty-row'>No bills due before the next payday.</td></tr>}
        {rows}
      </tbody><tfoot><tr><th colSpan='2' scope='row'>Covered</th><td className='bd-money'>{figure(period.coveredCents, 'covered')}</td></tr><tr className='bd-bottom'><th colSpan='2' scope='row'>{period.leftCents < 0 ? <span className='bd-short'><DownArrowIcon />Short</span> : 'Left'}</th><td className={`bd-money ${animate ? 'bd-rule-redraw' : ''}`}>{figure(Math.abs(period.leftCents), 'left')}</td></tr></tfoot>
      </table>
    </section>
  )
}
