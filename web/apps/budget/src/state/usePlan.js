import { useCallback, useEffect, useRef, useState } from 'react'
import * as budgetApi from '../api/budget.js'

export const usePlan = ({ active, editorOpen }) => {
  const [plan, setPlan] = useState({ paydays: [], bills: [] })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const operation = useRef(0)
  const controller = useRef(null)
  const lastLoad = useRef(0)

  const load = useCallback(async () => {
    const token = ++operation.current
    controller.current?.abort()
    controller.current = new AbortController()
    setStatus('loading'); setError(null)
    try {
      const value = await budgetApi.loadPlan({ signal: controller.current.signal })
      if (operation.current !== token) return
      setPlan(value); setStatus('ready'); lastLoad.current = Date.now()
    } catch (cause) {
      if (operation.current !== token || cause.name === 'AbortError') return
      setError(cause); setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!active) { operation.current++; controller.current?.abort(); setStatus('idle'); setPlan({ paydays: [], bills: [] }); return }
    load()
    return () => { operation.current++; controller.current?.abort() }
  }, [active, load])

  useEffect(() => {
    const onOnline = () => setOnline(true); const onOffline = () => setOnline(false)
    const onVisible = () => { if (document.visibilityState === 'visible' && active && !editorOpen && Date.now() - lastLoad.current >= 60000) load() }
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); document.removeEventListener('visibilitychange', onVisible) }
  }, [active, editorOpen, load])

  const upsert = useCallback((kind, entry) => setPlan((current) => {
    const key = kind === 'payday' ? 'paydays' : 'bills'; const list = current[key]; const index = list.findIndex(({ id }) => id === entry.id)
    return { ...current, [key]: index < 0 ? [...list, entry] : list.map((value, position) => position === index ? entry : value) }
  }), [])
  const remove = useCallback((kind, id, result) => setPlan((current) => {
    if (kind === 'bill') return { ...current, bills: current.bills.filter((entry) => entry.id !== id) }
    const revisions = new Map((result.unpinned || []).map((entry) => [entry.id, entry.rev]))
    return { paydays: current.paydays.filter((entry) => entry.id !== id), bills: current.bills.map((bill) => revisions.has(bill.id) ? { ...bill, paydayId: null, rev: revisions.get(bill.id) } : bill) }
  }), [])
  return { plan, status, error, online, load, upsert, remove }
}
