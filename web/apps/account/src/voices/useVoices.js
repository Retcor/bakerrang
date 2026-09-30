import { useCallback, useEffect, useRef, useState } from 'react'
import { VoiceApiError } from '../api/voices.js'

export const sortVoices = (voices) => [...voices].sort((a, b) => (Number(b.isPrimary) - Number(a.isPrimary)) || a.name.localeCompare(b.name))

// What a failed call means for the copy shown. A non-API rejection (network loss, a timeout, an
// abort) is `network`: the request may or may not have reached the server.
export const classifyFailure = (error) => {
  if (!(error instanceof VoiceApiError)) return 'network'
  if (error.status === 401) return 'auth'
  if (error.status === 404) return 'not_found'
  if (error.status === 413) return 'too_large'
  if (error.status === 400) return 'invalid'
  if (error.status === 429) return 'busy'
  return 'server'
}

const REFETCH_AFTER_MS = 60000

// Voice state for the Account sheet. Every write carries an epoch (bumped when the user signs
// out) and a per-voice token (replaced by a newer action on the same voice); a result from an
// older epoch or token is dropped, so a slow response can never overwrite newer state.
export const useVoices = ({ api, active, editorOpen = false, onUnauthorized }) => {
  const [status, setStatus] = useState('loading')
  const [voices, setVoices] = useState([])
  const [busy, setBusy] = useState({})
  const epoch = useRef(0)
  const tokens = useRef(new Map())
  const loadedAt = useRef(0)
  const editorRef = useRef(editorOpen)
  const unauthorized = useRef(onUnauthorized)
  editorRef.current = editorOpen
  unauthorized.current = onUnauthorized

  const load = useCallback(async ({ silent = false } = {}) => {
    const mine = epoch.current
    if (!silent) setStatus('loading')
    try {
      const list = await api.list()
      if (mine !== epoch.current) return
      loadedAt.current = Date.now()
      setVoices(list)
      setStatus('ready')
    } catch (error) {
      if (mine !== epoch.current) return
      if (classifyFailure(error) === 'auth') unauthorized.current?.()
      if (!silent) setStatus('error')
    }
  }, [api])

  useEffect(() => {
    if (!active) {
      epoch.current += 1
      tokens.current.clear()
      setVoices([])
      setBusy({})
      setStatus('loading')
      return undefined
    }
    load()
    return undefined
  }, [active, load])

  useEffect(() => {
    if (!active) return undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !editorRef.current && Date.now() - loadedAt.current >= REFETCH_AFTER_MS) load({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [active, load])

  const runOp = useCallback(async (key, kind, action, apply, { classify = classifyFailure } = {}) => {
    const mine = epoch.current
    const token = Symbol(key)
    tokens.current.set(key, token)
    setBusy((current) => ({ ...current, [key]: kind }))
    const stale = () => mine !== epoch.current || tokens.current.get(key) !== token
    try {
      const result = await action()
      if (stale()) return { ok: false, kind: 'stale' }
      apply(result)
      return { ok: true, result }
    } catch (error) {
      if (stale()) return { ok: false, kind: 'stale' }
      const failure = classify(error)
      if (failure === 'auth') unauthorized.current?.()
      if (failure === 'not_found') setVoices((current) => current.filter((voice) => voice.id !== key))
      return { ok: false, kind: failure, field: error?.field }
    } finally {
      if (mine === epoch.current && tokens.current.get(key) === token) {
        tokens.current.delete(key)
        setBusy((current) => {
          const { [key]: ignored, ...rest } = current
          return rest
        })
      }
    }
  }, [])

  const makePrimary = useCallback((id) => runOp(id, 'primary', () => api.makePrimary(id), (list) => {
    const primaries = new Set(list.filter((voice) => voice.isPrimary).map((voice) => voice.id))
    setVoices((current) => current.map((voice) => ({ ...voice, isPrimary: primaries.has(voice.id) })))
  }), [api, runOp])

  const rename = useCallback((id, fields) => runOp(id, 'rename', () => api.rename(id, fields), (voice) => {
    setVoices((current) => current.map((item) => item.id === id ? voice : item))
  }), [api, runOp])

  const remove = useCallback((id) => runOp(id, 'delete', () => api.remove(id), () => {
    setVoices((current) => current.filter((voice) => voice.id !== id))
  }), [api, runOp])

  // Create is never retried automatically: a lost response leaves the outcome unknown (`unknown`),
  // and only the user, after refreshing the list, decides whether to try again.
  const create = useCallback((fields) => runOp('__create__', 'create', () => api.create(fields), (voice) => {
    setVoices((current) => [...current.map((item) => voice.isPrimary ? { ...item, isPrimary: false } : item), voice])
  }, {
    classify: (error) => {
      const failure = classifyFailure(error)
      if (failure === 'server') return error.status === 502 ? 'provider' : 'unknown'
      return failure === 'network' ? 'unknown' : failure
    }
  }), [api, runOp])

  return { status, voices: sortVoices(voices), busy, load, refresh: () => load({ silent: true }), makePrimary, rename, remove, create }
}
