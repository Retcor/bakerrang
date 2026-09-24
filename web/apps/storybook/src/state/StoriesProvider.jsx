import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { createStoriesApi } from '../api/stories.js'
import { clearReadingPosition } from './readingPosition.js'

const StoriesContext = createContext(null)

export const StoriesProvider = ({ children, apiClient, apiBaseUrl, windowObject = window, documentObject = document }) => {
  const auth = useAuth()
  const api = useMemo(() => createStoriesApi({ apiClient, apiBaseUrl }), [apiBaseUrl, apiClient])
  const [stories, setStories] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const cache = useRef(new Map())

  const loadStories = useCallback(async () => {
    if (auth.status !== AUTH_STATUS.AUTHENTICATED) return
    setStatus((current) => current === 'ready' ? current : 'loading')
    try {
      setStories(await api.listStories())
      setError(null)
      setStatus('ready')
    } catch (nextError) {
      if (nextError.status === 401) await auth.refresh()
      setError(nextError)
      setStatus('error')
    }
  }, [api, auth])

  useEffect(() => {
    if (auth.status === AUTH_STATUS.AUTHENTICATED) loadStories()
    else if (auth.status === AUTH_STATUS.ANONYMOUS) {
      setStories([])
      setStatus('idle')
    }
  }, [auth.status, loadStories])

  useEffect(() => {
    const refreshVisible = () => {
      if (documentObject.visibilityState === 'visible' && auth.status === AUTH_STATUS.AUTHENTICATED) loadStories()
    }
    documentObject.addEventListener('visibilitychange', refreshVisible)
    windowObject.addEventListener('focus', refreshVisible)
    return () => {
      documentObject.removeEventListener('visibilitychange', refreshVisible)
      windowObject.removeEventListener('focus', refreshVisible)
    }
  }, [auth.status, documentObject, loadStories, windowObject])

  const remember = useCallback((story) => {
    cache.current.delete(story.id)
    cache.current.set(story.id, story)
    while (cache.current.size > 5) cache.current.delete(cache.current.keys().next().value)
  }, [])

  const getStory = useCallback(async (id) => {
    if (cache.current.has(id)) return cache.current.get(id)
    const story = await api.getStory(id)
    remember(story)
    return story
  }, [api, remember])

  const seedStory = useCallback((story) => {
    remember(story)
    const summary = {
      id: story.id,
      title: story.title,
      createdAt: story.createdAt,
      pageCount: story.pages.length,
      excerpt: story.pages[0]?.reply || '',
      thumbnail: story.thumbnail
    }
    setStories((current) => [summary, ...current.filter((item) => item.id !== story.id)])
    setStatus('ready')
  }, [remember])

  const renameStory = useCallback(async (id, title) => {
    const previous = stories
    setStories((current) => current.map((item) => item.id === id ? { ...item, title: title.trim() } : item))
    if (cache.current.has(id)) cache.current.set(id, { ...cache.current.get(id), title: title.trim() })
    try {
      const summary = await api.renameStory(id, title)
      setStories((current) => current.map((item) => item.id === id ? summary : item))
      if (cache.current.has(id)) cache.current.set(id, { ...cache.current.get(id), title: summary.title })
      return summary
    } catch (nextError) {
      setStories(previous)
      throw nextError
    }
  }, [api, stories])

  const deleteStory = useCallback(async (id) => {
    const previous = stories
    const cached = cache.current.get(id)
    setStories((current) => current.filter((item) => item.id !== id))
    cache.current.delete(id)
    try {
      await api.deleteStory(id)
      clearReadingPosition(id)
    } catch (nextError) {
      if (nextError.status !== 404) {
        setStories(previous)
        if (cached) cache.current.set(id, cached)
        throw nextError
      }
    }
  }, [api, stories])

  const value = useMemo(() => ({
    api,
    stories,
    status,
    error,
    loadStories,
    getStory,
    seedStory,
    renameStory,
    deleteStory
  }), [api, deleteStory, error, getStory, loadStories, renameStory, seedStory, status, stories])

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>
}

export const useStories = () => {
  const value = useContext(StoriesContext)
  if (!value) throw new Error('useStories must be used within a StoriesProvider')
  return value
}
