import { useCallback, useEffect, useRef, useState } from 'react'
import { deriveTitle, splitPages } from '../text.js'

export const compressImage = (base64, maxWidth = 400, quality = 0.82) => new Promise((resolve, reject) => {
  const image = new window.Image()
  image.onload = () => {
    try {
      const ratio = image.height / image.width
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = Math.round(maxWidth * ratio)
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    } catch (error) {
      reject(error)
    }
  }
  image.onerror = () => reject(new Error('Picture could not be prepared'))
  image.src = `data:image/png;base64,${base64}`
})

const initialState = { phase: 'idle', idea: '', total: 0, done: [], pages: [], story: null, error: null }
const guardedPhases = new Set(['writing', 'drawing', 'saving', 'saveFailed'])

export const useStoryGeneration = ({ api, onSaved, imageProcessor = compressImage, randomUUID = () => crypto.randomUUID(), now = () => new Date().toISOString(), windowObject = window, documentObject = document }) => {
  const [state, setState] = useState(initialState)
  const abortRef = useRef(null)

  const persist = useCallback(async (story) => {
    setState((current) => ({ ...current, phase: 'saving', story, error: null }))
    try {
      await api.saveStory(story)
      setState((current) => ({ ...current, phase: 'saved', story }))
      onSaved(story)
    } catch (error) {
      setState((current) => ({ ...current, phase: 'saveFailed', story, error }))
    }
  }, [api, onSaved])

  const start = useCallback(async (rawIdea) => {
    const idea = String(rawIdea || '').trim()
    if (!idea) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ ...initialState, phase: 'writing', idea })
    try {
      const written = await api.writeStory(idea, { signal: controller.signal })
      const replies = splitPages(written)
      if (!replies.length) throw new Error('The story came back empty')
      setState((current) => ({ ...current, phase: 'drawing', total: replies.length, done: Array(replies.length).fill(false), pages: replies.map((reply) => ({ reply, image: null })) }))

      const pictures = await Promise.all(replies.map(async (reply, index) => {
        try {
          const image = await api.drawPage(replies[index - 1] ?? '', reply, { signal: controller.signal })
          return image || null
        } catch (error) {
          if (controller.signal.aborted) throw error
          return null
        } finally {
          if (!controller.signal.aborted) setState((current) => ({ ...current, done: current.done.map((done, doneIndex) => doneIndex === index ? true : done) }))
        }
      }))
      if (controller.signal.aborted) return

      const pages = await Promise.all(replies.map(async (reply, index) => {
        let image = null
        if (pictures[index]) {
          try { image = await imageProcessor(pictures[index], 400, 0.82) } catch {}
        }
        return { reply, image }
      }))
      let thumbnail = null
      if (pictures[0]) {
        try { thumbnail = await imageProcessor(pictures[0], 200, 0.75) } catch {}
      }
      const story = { id: randomUUID(), title: deriveTitle(idea), prompt: idea, createdAt: now(), thumbnail, pages }
      await persist(story)
    } catch (error) {
      if (controller.signal.aborted) return
      setState((current) => ({ ...current, phase: 'writeFailed', error }))
    }
  }, [api, imageProcessor, now, persist, randomUUID])

  const retrySave = useCallback(() => {
    if (state.story) persist(state.story)
  }, [persist, state.story])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(initialState)
  }, [])

  const guarded = guardedPhases.has(state.phase)
  useEffect(() => {
    if (!guarded) return undefined
    const beforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const protectLinks = (event) => {
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || windowObject.confirm('Leave before this story is safely in your library?')) return
      event.preventDefault()
      event.stopPropagation()
    }
    windowObject.addEventListener('beforeunload', beforeUnload)
    documentObject.addEventListener('click', protectLinks, true)
    return () => {
      windowObject.removeEventListener('beforeunload', beforeUnload)
      documentObject.removeEventListener('click', protectLinks, true)
    }
  }, [documentObject, guarded, windowObject])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { state, start, retrySave, reset, guarded }
}
