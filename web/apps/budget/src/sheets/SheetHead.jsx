import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@bakerrang/web-ui'
import { BillIcon, ChevronLeftIcon, ChevronRightIcon, DebtIcon, OneOffIcon, PaydayIcon, PlusIcon } from '../Icons.jsx'
import { monthId } from '../plan/dates.js'
import { monthLabel } from '../plan/format.js'

const ADD_ITEMS = [
  ['payday', PaydayIcon, 'Payday', 'When you get paid, and how much'],
  ['bill', BillIcon, 'Bill', 'Due every month'],
  ['debt', DebtIcon, 'Debt', 'A monthly payment with an end'],
  ['one-off', OneOffIcon, 'One-off', 'Due once, on a date']
]

export const SheetHead = ({ month, previous, next, thisMonth, canAdd, firstRun, editorOpen, onAdd }) => {
  const [open, setOpen] = useState(false); const root = useRef(null); const trigger = useRef(null); const menu = useRef(null); const location = useLocation(); const plan = location.pathname === '/plan'
  useEffect(() => { const dismiss = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }; document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss) }, [])
  const choose = (kind) => { setOpen(false); onAdd(kind) }
  const showMenu = () => { setOpen(true); window.setTimeout(() => menu.current?.querySelector('button')?.focus(), 0) }
  const onMenuKeyDown = (event) => {
    const items = [...menu.current.querySelectorAll('[role="menuitem"]')]; const index = items.indexOf(document.activeElement)
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; items[next]?.focus()
  }
  const sheets = <nav aria-label='Budget sheets'><Link aria-current={!plan ? 'page' : undefined} to={`/month/${monthId(month)}`}>Month</Link><Link aria-current={plan ? 'page' : undefined} to='/plan'>Plan</Link></nav>
  return (
    <header className={`bd-sheet-head ${plan ? 'is-plan' : ''}`}>
      {plan
        ? <h1 className='bd-plan-title'>Plan</h1>
        : <div className='bd-month-nav'><Link to={`/month/${monthId(previous)}`} aria-label={`Previous month, ${monthLabel(previous)}`}><ChevronLeftIcon /></Link><h1>{monthLabel(month)}</h1><Link to={`/month/${monthId(next)}`} aria-label={`Next month, ${monthLabel(next)}`}><ChevronRightIcon /></Link>{monthId(month) !== monthId(thisMonth) && <Link className='bd-this-month' to={`/month/${monthId(thisMonth)}`}>This month</Link>}</div>}
      {sheets}
      {canAdd && (
        <div className={`br-menu bd-add-menu ${open ? 'is-open' : ''} ${editorOpen ? 'is-hidden' : ''}`} ref={root}>
          <Button ref={trigger} variant={firstRun ? 'ghost' : 'gold'} className='bd-add' type='button' aria-haspopup='menu' aria-expanded={open} onClick={() => open ? setOpen(false) : showMenu()} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); showMenu() } }}><PlusIcon />Add</Button>
          {open && <div ref={menu} className='br-popover bd-add-pop' role='menu' aria-label='Add to your plan' onKeyDown={onMenuKeyDown}>{ADD_ITEMS.map(([kind, ItemIcon, label, description]) => <button type='button' role='menuitem' className='br-popover__item' aria-label={label} key={kind} onClick={() => choose(kind)}><ItemIcon /><span>{label}<small>{description}</small></span></button>)}</div>}
        </div>
      )}
      {plan && <p className='bd-head-sub'>Your paydays and bills. A change here applies to every month.</p>}
    </header>
  )
}
