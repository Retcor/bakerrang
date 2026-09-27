import React from 'react'
import { formatCents, monthLabel } from '../plan/format.js'

export const Statement = ({ month, statement, hidden, refoot }) => {
  const changed = (kind) => Boolean(refoot?.active && (kind === 'net' || kind === (refoot.kind === 'payday' ? 'paychecks' : 'bills')))
  const figure = (kind, value, options) => <span key={`${refoot?.nonce || 0}-${kind}`} className={`bd-fig ${changed(kind) ? 'is-refooting' : ''}`}>{formatCents(value, options)}</span>
  return <footer className={`bd-statement ${hidden ? 'is-hidden' : ''}`} aria-label={`${monthLabel(month)} totals`}><p><b>{monthLabel(month).toUpperCase()}</b><span>Paychecks received and bills due this month</span></p><dl><div><dt>Paychecks</dt><dd>{figure('paychecks', statement.paychecksCents)}</dd></div><div><dt>Bills</dt><dd>{figure('bills', statement.billsCents)}</dd></div><div><dt>Net</dt><dd aria-label={`Net ${statement.netCents < 0 ? 'minus' : statement.netCents > 0 ? 'plus' : ''} ${formatCents(Math.abs(statement.netCents))}`}>{figure('net', statement.netCents, { signed: true })}</dd></div></dl></footer>
}
