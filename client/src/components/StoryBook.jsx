import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { SERVER_PREFIX } from '../App.jsx'
import { v4 } from 'uuid'
import remarkGfm from 'remark-gfm'
import { request } from '../utils/index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { AudioStreamPlayerSelector, LoadingSpinner, ContentWrapper, InputWrapper, ConfirmModal } from './index.js'

const compressImage = (base64, maxWidth = 400, quality = 0.82) =>
  new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.height / img.width
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = Math.round(maxWidth * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    }
    img.src = `data:image/png;base64,${base64}`
  })

const compressThumbnail = (base64) => compressImage(base64, 200, 0.75)

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const StoryBook = () => {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [storyBookPages, setStoryBookPages] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [loadingDescription, setLoadingDescription] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [page, setPage] = useState(1)
  // saved stories
  const [savedStories, setSavedStories] = useState([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  // ID of the story currently open/saved — determines Save vs Edit+Delete in header
  const [currentStoryId, setCurrentStoryId] = useState(null)
  const [isLoadedStory, setIsLoadedStory] = useState(false)

  useEffect(() => {
    request(`${SERVER_PREFIX}/storybook`, 'GET')
      .then(r => r.json())
      .then(stories => {
        const sorted = [...stories].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setSavedStories(sorted)
        if (sorted.length > 0) setLibraryOpen(false)
      })
      .catch(console.error)
  }, [])

  const handleClearClick = () => setPrompt('')

  const handleNewStoryClick = () => {
    setConfirmAction('newStory')
    setConfirmOpen(true)
  }

  const handleGenerateStory = async () => {
    if (storyBookPages.length) {
      setConfirmAction('generateStory')
      setConfirmOpen(true)
    } else {
      await getGPTResponse()
    }
  }

  const handleConfirm = () => {
    if (confirmAction === 'newStory') {
      setStoryBookPages([])
      setPrompt('')
      setPage(1)
      setIsLoadedStory(false)
      setCurrentStoryId(null)
    } else if (confirmAction === 'generateStory') {
      getGPTResponse()
    }
    setConfirmOpen(false)
    setConfirmAction(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && prompt.trim() && !loading) handleGenerateStory()
  }

  const handleChange = (event, value) => setPage(value)

  const getGPTResponse = async () => {
    setLoading(true)
    setStoryBookPages([])
    setIsLoadedStory(false)
    setCurrentStoryId(null)
    setConfirmOpen(false)
    try {
      setLoadingDescription('Generating story...')
      const res = await request(`${SERVER_PREFIX}/chat/gpt/prompt/story?prompt=${prompt}`, 'GET')
      const reply = await res.text()
      const replyArr = reply.split('\n').filter(i => i)

      const durationInSeconds = 5 + replyArr.length - 1
      const intervalTime = Math.floor((durationInSeconds * 1000) / 100)
      const interval = setInterval(() => {
        setPercentage((prev) => {
          const next = prev + 1
          if (next >= 100) clearInterval(interval)
          return next
        })
      }, intervalTime)

      setLoadingDescription(`Generating image${replyArr.length > 1 ? 's' : ''}...`)
      const replyImgArr = await Promise.all(replyArr.map(async (text, index) => {
        const imageRes = await request(`${SERVER_PREFIX}/chat/gpt/image/prompt?prompt=${replyArr[index - 1]}${text}`, 'GET')
        const image = await imageRes.text()
        return { id: v4(), reply: text, image }
      }))
      clearInterval(interval)
      setPercentage(0)
      setStoryBookPages(replyImgArr)
    } catch (ex) {
      console.log(ex)
    }
    setLoading(false)
  }

  const handleOpenSaveModal = () => {
    setSaveTitle('')
    setSaveModalOpen(true)
  }

  const handleSaveStory = async () => {
    if (!saveTitle.trim()) return
    setIsSaving(true)
    try {
      const compressedPages = isLoadedStory
        ? storyBookPages.map(p => ({ reply: p.reply, image: p.image || null }))
        : await Promise.all(storyBookPages.map(async (p) => ({
            reply: p.reply,
            image: p.image ? await compressImage(p.image) : null
          })))

      const thumbnail = isLoadedStory
        ? (storyBookPages[0]?.image || null)
        : (storyBookPages[0]?.image ? await compressThumbnail(storyBookPages[0].image) : null)

      const story = {
        id: v4(),
        title: saveTitle.trim(),
        prompt,
        createdAt: new Date().toISOString(),
        thumbnail,
        pages: compressedPages
      }

      const res = await request(`${SERVER_PREFIX}/storybook`, 'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify(story)
      )
      const saved = await res.json()
      setSavedStories(prev => [saved, ...prev])
      setCurrentStoryId(saved.id)
      setSaveModalOpen(false)
      setSaveTitle('')
    } catch (err) {
      console.error(err)
    }
    setIsSaving(false)
  }

  const handleOpenStory = (story) => {
    setStoryBookPages(story.pages)
    setPrompt(story.prompt)
    setPage(1)
    setIsLoadedStory(true)
    setCurrentStoryId(story.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteStory = async () => {
    if (!deleteTarget) return
    try {
      await request(`${SERVER_PREFIX}/storybook/${deleteTarget.id}`, 'DELETE')
      setSavedStories(prev => prev.filter(s => s.id !== deleteTarget.id))
      // If the currently-open story was deleted, clear the display
      if (currentStoryId === deleteTarget.id) {
        setStoryBookPages([])
        setPrompt('')
        setPage(1)
        setIsLoadedStory(false)
        setCurrentStoryId(null)
      }
    } catch (err) {
      console.error(err)
    }
    setDeleteTarget(null)
  }

  const handleOpenRenameModal = (story) => {
    setRenameTarget(story)
    setRenameTitle(story.title)
  }

  // Rename from story header (currently open story)
  const handleOpenHeaderRename = () => {
    const story = savedStories.find(s => s.id === currentStoryId)
    if (story) handleOpenRenameModal(story)
  }

  const handleRenameStory = async () => {
    if (!renameTarget || !renameTitle.trim()) return
    setIsRenaming(true)
    try {
      const updated = { ...renameTarget, title: renameTitle.trim() }
      await request(`${SERVER_PREFIX}/storybook`, 'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify(updated)
      )
      setSavedStories(prev => prev.map(s => s.id === updated.id ? updated : s))
      setRenameTarget(null)
      setRenameTitle('')
    } catch (err) {
      console.error(err)
    }
    setIsRenaming(false)
  }

  const imgSrc = (p) => {
    if (!p.image) return null
    const mime = isLoadedStory ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${p.image}`
  }

  const btnBase = `px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 border`
  const btnGlass = `${btnBase} ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20 border-white/20' : 'glass-light text-theme-light hover:bg-black/20 border-black/20'}`

  return (
    <ContentWrapper title='Story Book'>

      {/* ── Saved Stories Library (top, collapsible) ── */}
      <div className={`rounded-2xl overflow-hidden mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        {/* Header — clickable to toggle */}
        <button
          onClick={() => setLibraryOpen(o => !o)}
          className={`w-full px-6 py-4 flex items-center justify-between transition-colors duration-200 ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
        >
          <div className='flex items-center space-x-3'>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-4 h-4 ${isDark ? 'text-gray-900' : 'text-white'}`}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' />
              </svg>
            </div>
            <div className='text-left'>
              <p className={`text-sm font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Saved Stories</p>
              <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{savedStories.length} {savedStories.length === 1 ? 'story' : 'stories'} saved</p>
            </div>
          </div>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' strokeWidth='2' stroke='currentColor'
            className={`w-4 h-4 transition-transform duration-200 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'} ${libraryOpen ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
          </svg>
        </button>

        {/* Collapsible content */}
        {libraryOpen && (
          <div className={`border-t px-4 py-4 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            {savedStories.length === 0
              ? (
                <div className='flex flex-col items-center justify-center py-8 text-center'>
                  <p className={`font-semibold mb-1 text-sm ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>No saved stories yet</p>
                  <p className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Generate a story and click Save to keep it here</p>
                </div>
                )
              : (
                <div className='flex gap-3 overflow-x-auto pb-2' style={{ scrollbarWidth: 'thin' }}>
                  {savedStories.map(story => (
                    <div
                      key={story.id}
                      className={`w-36 flex-shrink-0 rounded-xl overflow-hidden border transition-all duration-200 hover:scale-[1.02] ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}
                    >
                      {/* Thumbnail */}
                      <div className='w-full aspect-square overflow-hidden'>
                        {story.thumbnail
                          ? <img src={`data:image/jpeg;base64,${story.thumbnail}`} alt={story.title} className='w-full h-full object-cover' />
                          : (
                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1' stroke='currentColor' className={`w-8 h-8 ${isDark ? 'text-white/20' : 'text-black/20'}`}>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' />
                              </svg>
                            </div>
                            )}
                      </div>
                      {/* Card Info */}
                      <div className='p-2'>
                        <p className={`font-semibold text-xs truncate mb-0.5 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{story.title}</p>
                        <p className={`text-xs truncate mb-2 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>{formatDate(story.createdAt)}</p>
                        <div className='flex items-center gap-1'>
                          <button
                            onClick={() => handleOpenStory(story)}
                            className={`flex-1 py-1 rounded-md text-xs font-medium transition-all duration-200 ${isDark ? 'bg-accent-dark text-gray-900 hover:opacity-90' : 'bg-accent-light text-white hover:opacity-90'}`}
                          >
                            Open
                          </button>
                          {/* Pencil / rename */}
                          <button
                            onClick={() => handleOpenRenameModal(story)}
                            className={`p-1 rounded-md transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/10'}`}
                            title='Rename story'
                          >
                            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-3.5 h-3.5'>
                              <path d='M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z' />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(story)}
                            className={`p-1 rounded-md transition-all duration-200 ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-500/10'}`}
                            title='Delete story'
                          >
                            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-3.5 h-3.5'>
                              <path fillRule='evenodd' d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z' clipRule='evenodd' />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
          </div>
        )}
      </div>

      {/* ── Input Section (only when no story showing) ── */}
      {storyBookPages.length === 0 && (
        <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <div className='flex items-center space-x-4 mb-6'>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' />
              </svg>
            </div>
            <div>
              <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Story Book</h2>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                Create immersive stories with AI-generated text, images, and voice narration
              </p>
            </div>
          </div>
          <div className='space-y-4'>
            <div className='relative'>
              <InputWrapper label='What story would you like to hear about?' value={prompt} setValue={setPrompt} onKeyDown={handleKeyDown} className='pr-12' />
              {prompt && (
                <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
                  <button className={`p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:text-red-400 hover:bg-red-500/10' : 'text-theme-secondary-light hover:text-red-500 hover:bg-red-500/10'}`} onClick={handleClearClick} disabled={loading} title='Clear input'>
                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                      <path fillRule='evenodd' d='M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z' clipRule='evenodd' />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {prompt && (
              <div className='flex justify-end'>
                <button type='button' className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateStory() }} disabled={loading || !prompt.trim()}>
                  {loading
                    ? <div className='flex items-center space-x-1 sm:space-x-2'><LoadingSpinner svgClassName='!h-4 !w-4' /><span className='hidden sm:inline'>Generating...</span><span className='sm:hidden'>...</span></div>
                    : <div className='flex items-center space-x-1 sm:space-x-2'>
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'><path d='M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z' /></svg>
                        <span className='hidden sm:inline'>Generate Story</span>
                        <span className='sm:hidden'>Generate</span>
                      </div>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmAction === 'newStory' ? 'New Story' : 'Generate New Story'}
        message={confirmAction === 'newStory'
          ? 'Are you sure you want to start a new story? This will clear the current story.'
          : 'Are you sure you want to generate a new story? This will replace the current story.'
        }
        confirmFunc={handleConfirm}
        cancelFunc={() => { setConfirmOpen(false); setConfirmAction(null) }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title='Delete Story'
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmFunc={handleDeleteStory}
        cancelFunc={() => setDeleteTarget(null)}
      />

      {/* Save modal */}
      {saveModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4' style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Save Story</h3>
            <InputWrapper label='Story Name' value={saveTitle} setValue={setSaveTitle} onKeyDown={(e) => { if (e.key === 'Enter' && saveTitle.trim()) handleSaveStory() }} />
            <div className='flex justify-end space-x-3 mt-5'>
              <button onClick={() => setSaveModalOpen(false)} className={btnGlass}>Cancel</button>
              <button onClick={handleSaveStory} disabled={!saveTitle.trim() || isSaving} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-40 flex items-center space-x-2 ${isDark ? 'bg-accent-dark text-gray-900 hover:opacity-90' : 'bg-accent-light text-white hover:opacity-90'}`}>
                {isSaving ? <><LoadingSpinner svgClassName='!h-4 !w-4' /><span>Saving...</span></> : <span>Save</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4' style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Rename Story</h3>
            <InputWrapper label='Story Name' value={renameTitle} setValue={setRenameTitle} onKeyDown={(e) => { if (e.key === 'Enter' && renameTitle.trim()) handleRenameStory() }} />
            <div className='flex justify-end space-x-3 mt-5'>
              <button onClick={() => setRenameTarget(null)} className={btnGlass}>Cancel</button>
              <button onClick={handleRenameStory} disabled={!renameTitle.trim() || isRenaming} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-40 flex items-center space-x-2 ${isDark ? 'bg-accent-dark text-gray-900 hover:opacity-90' : 'bg-accent-light text-white hover:opacity-90'}`}>
                {isRenaming ? <><LoadingSpinner svgClassName='!h-4 !w-4' /><span>Saving...</span></> : <span>Rename</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading Progress ── */}
      {loading && (
        <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'} shadow-2xl`}>
          <div className='flex items-center space-x-4 mb-6'>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'} shadow-lg`}>
              <LoadingSpinner svgClassName={`!h-8 !w-8 ${isDark ? '!text-gray-900' : '!text-white'}`} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{loadingDescription}</h3>
              <p className={`text-base font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Please wait while we create your story...</p>
            </div>
          </div>
          <div className='space-y-3'>
            <div className='flex justify-between items-center'>
              <span className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</span>
              <span className={`text-lg font-bold px-3 py-1 rounded-lg ${isDark ? 'text-gray-900 bg-accent-dark' : 'text-white bg-accent-light'}`}>{percentage}%</span>
            </div>
            <div className={`w-full rounded-full h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} shadow-inner`}>
              <div className={`h-4 rounded-full transition-all duration-500 shadow-sm ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Story Display ── */}
      {storyBookPages.length > 0 && (
        <div className={`rounded-2xl overflow-hidden transition-all duration-300 mb-8 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          {/* Story Header */}
          <div className={`px-4 sm:px-8 py-4 sm:py-6 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
            <div className='flex items-center justify-between flex-wrap gap-4'>
              <div className='flex items-center space-x-4'>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
                  <svg className={`w-6 h-6 ${isDark ? 'text-gray-900' : 'text-white'}`} fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z' clipRule='evenodd' />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                    {currentStoryId ? (savedStories.find(s => s.id === currentStoryId)?.title || 'Your Story') : 'Your Story'}
                  </h3>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Page {page} of {storyBookPages.length}</p>
                </div>
              </div>
              <div className='flex items-center space-x-2 sm:space-x-3 flex-wrap gap-2'>
                {/* Unsaved: show Save. Saved/opened: show Rename + Delete */}
                {!currentStoryId
                  ? (
                    <button onClick={handleOpenSaveModal} className={btnGlass}>
                      <div className='flex items-center space-x-1 sm:space-x-2'>
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                          <path d='M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z' />
                          <path fillRule='evenodd' d='M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z' clipRule='evenodd' />
                        </svg>
                        <span>Save</span>
                      </div>
                    </button>
                    )
                  : (
                    <>
                      <button onClick={handleOpenHeaderRename} className={`p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:bg-white/10' : 'text-theme-secondary-light hover:bg-black/10'}`} title='Rename story'>
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-5 h-5'>
                          <path d='M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z' />
                        </svg>
                      </button>
                      <button
                        onClick={() => { const s = savedStories.find(x => x.id === currentStoryId); if (s) setDeleteTarget(s) }}
                        className={`p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-500/10'}`}
                        title='Delete story'
                      >
                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-5 h-5'>
                          <path fillRule='evenodd' d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z' clipRule='evenodd' />
                        </svg>
                      </button>
                    </>
                    )}
                {/* New Story */}
                <button onClick={handleNewStoryClick} className={btnGlass}>
                  <div className='flex items-center space-x-1 sm:space-x-2'>
                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                      <path fillRule='evenodd' d='M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5H12.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z' clipRule='evenodd' />
                    </svg>
                    <span className='hidden sm:inline'>New Story</span>
                    <span className='sm:hidden'>New</span>
                  </div>
                </button>
                <AudioStreamPlayerSelector prompt={storyBookPages[page - 1].reply} />
              </div>
            </div>
          </div>

          {/* Story Content */}
          <div className='p-4 sm:p-8'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
              <div className='lg:col-span-2 space-y-4'>
                <div className={`prose prose-lg max-w-none ${isDark ? 'prose-invert' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className={`text-base leading-relaxed ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                    {storyBookPages[page - 1].reply}
                  </ReactMarkdown>
                </div>
              </div>
              <div className='lg:col-span-1'>
                {imgSrc(storyBookPages[page - 1]) && (
                  <div className='sticky top-8'>
                    <div className={`rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-2xl ${isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-black/10'}`}>
                      <img alt='Generated story illustration' className='w-full h-auto object-cover' src={imgSrc(storyBookPages[page - 1])} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {storyBookPages.length > 1 && (
              <div className={`flex justify-center mt-12 pt-8 border-t ${isDark ? 'border-white/20' : 'border-black/20'}`}>
                <nav className='flex items-center space-x-2'>
                  {Array.from({ length: storyBookPages.length }).map((_, index) => (
                    <button
                      key={index}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${index + 1 === page ? (isDark ? 'btn-primary-dark' : 'btn-primary-light') : (isDark ? 'text-theme-dark hover:bg-white/10 border border-white/20' : 'text-theme-light hover:bg-black/10 border border-black/20')}`}
                      onClick={() => handleChange(null, index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </div>
      )}

    </ContentWrapper>
  )
}

export default StoryBook
