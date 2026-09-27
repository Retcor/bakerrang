import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { EntryEditor } from '../editor/EntryEditor.jsx'
import { allocateMonth } from '../plan/allocate.js'
import { formatCents } from '../plan/format.js'
import { PeriodTable } from './PeriodTable.jsx'
import { Statement } from './Statement.jsx'

export const MonthSheet = ({ plan, month, today, editor, editorProps, onEdit, refoot }) => {
  const view = useMemo(() => allocateMonth(plan, month, today), [month, plan, today])
  return (
    <>
      {view.issues > 0 && <aside className='bd-notice'>{view.issues} bill{view.issues === 1 ? '' : 's'} in your plan {view.issues === 1 ? 'has' : 'have'} no due day, so {view.issues === 1 ? "it isn't" : "they aren't"} on any month. <Link to='/plan'>Open Plan</Link></aside>}
      <div className='bd-column-head' aria-hidden='true'><span>Due</span><span>Bill</span><span>Amount</span></div>
      {view.periods.length === 0 && view.uncovered.length === 0 && <div className='bd-empty'><h2>Nothing is due this month.</h2><p>No paychecks or bills fall in this month.</p></div>}
      {view.uncovered.length > 0 && <section className='bd-period'><h2 className='bd-payband'><span>No paycheck</span><strong>Not covered yet</strong></h2><p className='bd-period__line'>Add a payday and Budget will split these across your paychecks.</p><table className='bd-ledger'><caption className='bd-sr'>Bills not covered by a paycheck</caption><tbody>{view.uncovered.map(({ bill, day }) => { const active = editor?.entry?.id === bill.id; return <React.Fragment key={`${bill.id}@${day}`}><tr><td /><th scope='row'><button type='button' aria-expanded={active} onClick={() => onEdit('bill', bill)}>{bill.name}</button></th><td className='bd-money'>{formatCents(bill.amountCents)}</td></tr>{active && <tr className='bd-editor-row'><td colSpan='3'><EntryEditor {...editorProps} kind={editor.kind} entry={bill} /></td></tr>}</React.Fragment> })}</tbody></table></section>}
      {view.periods.map((period) => <PeriodTable key={period.id} period={period} editor={editor} editorProps={editorProps} onEdit={onEdit} refoot={refoot} />)}
      <Statement month={month} statement={view.statement} hidden={Boolean(editor)} refoot={refoot} />
    </>
  )
}
