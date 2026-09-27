/* eslint-disable react/jsx-handler-names, react/jsx-closing-tag-location */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountMenu, AppSwitcher, BrandLink, resolveDestinations } from '@bakerrang/web-app-shell'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { Button } from '@bakerrang/web-ui'
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import logoUrl from '../../polyglot/src/assets/bakerrang-logo.png'
import { isoDate, localToday, monthId, parseMonth, shiftMonth } from './plan/dates.js'
import { allocateMonth } from './plan/allocate.js'
import { formatCents, monthLabel } from './plan/format.js'
import { usePlan } from './state/usePlan.js'
import { MonthSheet } from './sheets/MonthSheet.jsx'
import { PlanSheet } from './sheets/PlanSheet.jsx'
import { SheetHead } from './sheets/SheetHead.jsx'
import { Welcome } from './Welcome.jsx'
import { NotFound } from './NotFound.jsx'
import { PlusIcon } from './Icons.jsx'

const destinations = resolveDestinations(import.meta.env)

const AppBar = ({ signedIn, onLogout }) => { const auth = useAuth(); return <header className='bd-bar'><div className='bd-bar__inner'><BrandLink logoSrc={logoUrl} launcherUrl={destinations.launcher.url} appName='Budget' appUrl='/' /><span className='bd-bar__spacer' />{signedIn ? <><AppSwitcher destinations={destinations} current='budget' /><AccountMenu destinations={destinations} themeControl onLogout={onLogout} /></> : <Button variant='ghost' size='small' onClick={auth.login}>Sign in</Button>}</div></header> }

const todayMonth = (today) => { const [year, month] = isoDate(today).split('-').map(Number); return { year, month } }

const BudgetSurface = ({ route }) => {
  const auth = useAuth(); const params = useParams(); const location = useLocation(); const navigate = useNavigate()
  const [today, setToday] = useState(localToday); const fallbackMonth = useMemo(() => todayMonth(today), [today])
  const requested = route === 'month' && params.ym !== undefined ? parseMonth(params.ym) : fallbackMonth
  const [editor, setEditor] = useState(null); const [editorDirty, setEditorDirty] = useState(false); const [pendingAction, setPendingAction] = useState(null)
  const editorTrigger = useRef(null)
  const model = usePlan({ active: auth.status === AUTH_STATUS.AUTHENTICATED, editorOpen: Boolean(editor) })
  const [announcement, setAnnouncement] = useState(''); const [showLoading, setShowLoading] = useState(false); const [refoot, setRefoot] = useState(null)
  const runAction = useCallback((action) => {
    setPendingAction(null); setEditorDirty(false)
    if (action.type === 'open') { setEditor({ kind: action.kind, entry: action.entry }); return }
    if (action.type === 'add') {
      if (route === 'plan') setEditor({ kind: action.kind, entry: null })
      else { setEditor(null); navigate('/plan', { state: { add: action.kind } }) }
      return
    }
    setEditor(null)
    if (action.type === 'close') window.setTimeout(() => editorTrigger.current?.focus(), 0)
    if (action.type === 'logout') { auth.logout(); return }
    if (action.type === 'href') {
      const target = new URL(action.href, window.location.href)
      if (target.origin === window.location.origin) navigate(`${target.pathname}${target.search}${target.hash}`)
      else window.location.assign(target.href)
    }
  }, [auth, navigate, route])
  const requestAction = useCallback((action) => {
    if (editor && editorDirty) setPendingAction(action)
    else runAction(action)
  }, [editor, editorDirty, runAction])
  useEffect(() => { const onVisible = () => { if (document.visibilityState === 'visible') setToday(localToday()) }; document.addEventListener('visibilitychange', onVisible); return () => document.removeEventListener('visibilitychange', onVisible) }, [])
  useEffect(() => { if (model.status !== 'loading') { setShowLoading(false); return }; const id = window.setTimeout(() => setShowLoading(true), 300); return () => window.clearTimeout(id) }, [model.status])
  useEffect(() => {
    const add = location.state?.add
    setEditor(add ? { kind: add, entry: null } : null); setEditorDirty(false); setPendingAction(null)
    if (add) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname])
  useEffect(() => {
    if (!editor || !editorDirty) return
    const guardLinks = (event) => {
      const link = event.target.closest?.('a[href]')
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault(); event.stopPropagation(); setPendingAction({ type: 'href', href: link.href })
    }
    document.addEventListener('click', guardLinks, true)
    return () => document.removeEventListener('click', guardLinks, true)
  }, [editor, editorDirty])
  if (!requested) return <><AppBar signedIn={auth.status === AUTH_STATUS.AUTHENTICATED} /><NotFound /></>
  if (auth.status === AUTH_STATUS.LOADING) return <><AppBar signedIn={false} /><main className='bd-quiet' /></>
  if (auth.status !== AUTH_STATUS.AUTHENTICATED) return <><AppBar signedIn={false} /><Welcome /></>
  const month = requested; const firstRun = route === 'month' && model.status === 'ready' && model.plan.paydays.length === 0 && model.plan.bills.length === 0
  const announceResult = (verb, name, nextPlan, change) => {
    const statement = allocateMonth(nextPlan, month, today).statement
    setRefoot({ ...change, nonce: Date.now() })
    setAnnouncement(`${verb} ${name}. ${monthLabel(month)} net is ${formatCents(statement.netCents, { signed: true })}.`)
  }
  const openEditor = (kind, entry = null) => { editorTrigger.current = document.activeElement; requestAction(entry ? { type: 'open', kind, entry } : { type: 'add', kind }) }
  const closeEditor = () => requestAction({ type: 'close' })
  const editorProps = {
    paydays: model.plan.paydays,
    bills: model.plan.bills,
    online: model.online,
    onClose: closeEditor,
    onDirtyChange: setEditorDirty,
    discardPrompt: Boolean(pendingAction),
    onKeepEditing: () => setPendingAction(null),
    onDiscard: () => runAction(pendingAction),
    onSaved: (entry, verb) => { const kind = editor.kind === 'payday' ? 'payday' : 'bill'; const key = kind === 'payday' ? 'paydays' : 'bills'; const list = model.plan[key]; const nextPlan = { ...model.plan, [key]: list.some(({ id }) => id === entry.id) ? list.map((value) => value.id === entry.id ? entry : value) : [...list, entry] }; const prior = editor.entry; const active = !prior || JSON.stringify([prior.amountCents, prior.schedule, prior.due, prior.paydayId]) !== JSON.stringify([entry.amountCents, entry.schedule, entry.due, entry.paydayId]); model.upsert(kind, entry); setEditor(null); setEditorDirty(false); announceResult(verb, entry.name, nextPlan, { id: entry.id, kind, active }); window.setTimeout(() => editorTrigger.current?.focus(), 0) },
    onDeleted: (result) => { const kind = editor.kind === 'payday' ? 'payday' : 'bill'; const key = kind === 'payday' ? 'paydays' : 'bills'; const unpinned = new Map((result.unpinned || []).map((item) => [item.id, item.rev])); const nextPlan = { ...model.plan, [key]: model.plan[key].filter(({ id }) => id !== editor.entry.id), bills: kind === 'payday' ? model.plan.bills.map((bill) => unpinned.has(bill.id) ? { ...bill, paydayId: null, rev: unpinned.get(bill.id) } : bill) : model.plan.bills.filter(({ id }) => id !== editor.entry.id) }; model.remove(kind, editor.entry.id, result); setEditor(null); setEditorDirty(false); announceResult('Deleted', editor.entry.name, nextPlan, { id: editor.entry.id, kind, active: true }); window.setTimeout(() => editorTrigger.current?.focus(), 0) }
  }
  return (
    <div className={`bd-app ${editor ? 'has-editor' : ''}`}><AppBar signedIn onLogout={() => requestAction({ type: 'logout' })} /><main className='bd-sheet'><SheetHead month={month} previous={shiftMonth(month, -1)} next={shiftMonth(month, 1)} thisMonth={fallbackMonth} canAdd={model.status === 'ready'} firstRun={firstRun} editorOpen={Boolean(editor)} onAdd={openEditor} />
      {!model.online && model.status === 'ready' && <aside className='bd-notice'><b>You're offline.</b> You can read this month, but changes can't be saved until you're back.</aside>}
      {model.status === 'loading' && showLoading && <div className='bd-state'><span className='bd-spinner' />Loading your plan…</div>}
      {model.status === 'error' && <div className='bd-state' role='alert'><h2>Budget couldn't load your plan.</h2><p>Nothing was changed. Check your connection, then try again.</p><button className='bd-btn bd-btn--save' onClick={model.load}>Try again</button></div>}
      {firstRun && <div className='bd-first-run'><h2>Start with a payday.</h2><p>Budget lines your bills up against your paychecks. Each paycheck shows what it has to pay before the next one arrives, and what's left.</p><ol><li><b>1</b>Add when you get paid and how much.</li><li><b>2</b>Add your monthly bills, debts and one-offs.</li><li><b>3</b>Month shows which paycheck covers each bill.</li></ol><Button variant='gold' className='bd-add' onClick={() => openEditor('payday')}><PlusIcon />Add a payday</Button></div>}
      {model.status === 'ready' && !firstRun && (route === 'plan' ? <PlanSheet plan={model.plan} editor={editor} editorProps={editorProps} onOpen={openEditor} onAdd={openEditor} currentMonth={monthId(fallbackMonth)} /> : <MonthSheet plan={model.plan} month={month} today={today} editor={editor} editorProps={editorProps} onEdit={openEditor} refoot={refoot} />)}
    </main><div className='bd-live' role='status' aria-live='polite'>{announcement}</div>
    </div>
  )
}

export const App = () => <BrowserRouter><Routes><Route path='/' element={<BudgetSurface route='month' />} /><Route path='/month/:ym' element={<BudgetSurface route='month' />} /><Route path='/plan' element={<BudgetSurface route='plan' />} /><Route path='*' element={<><AppBar signedIn={false} /><NotFound /></>} /></Routes></BrowserRouter>
