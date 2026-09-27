import React from 'react'
import { PlanTable } from './PlanTable.jsx'

export const PlanSheet = ({ plan, editor, editorProps, onOpen, onAdd, currentMonth }) => {
  const groups = { Bills: plan.bills.filter(({ category }) => category === 'utility'), Debts: plan.bills.filter(({ category }) => category === 'debt'), 'One-offs': plan.bills.filter(({ category }) => category === 'one-time') }
  const sum = (entries) => entries.filter((entry) => entry.active && entry.amountCents !== null && !entry.issues?.includes('amount') && (entry.category !== 'debt' || !entry.lastPaymentMonth || entry.lastPaymentMonth >= currentMonth)).reduce((total, entry) => total + entry.amountCents, 0)
  return <div className='bd-plan'><PlanTable title='Paydays' baseKind='payday' entries={plan.paydays} editor={editor} editorProps={editorProps} onOpen={onOpen} onAdd={onAdd} monthlyTotal={null} />{Object.entries(groups).map(([title, entries]) => <PlanTable key={title} title={title} baseKind='bill' entries={entries} editor={editor} editorProps={editorProps} onOpen={onOpen} onAdd={onAdd} monthlyTotal={title === 'One-offs' ? null : sum(entries)} />)}</div>
}
