import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { SERVER_PREFIX } from '../App.jsx'
import { v4 } from 'uuid'
import remarkGfm from 'remark-gfm'
import { request } from '../utils/index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { AudioStreamPlayerSelector, LoadingSpinner, ContentWrapper, InputWrapper, ConfirmModal } from './index.js'

const StoryBook = () => {
  const { isDark } = useTheme()
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [storyBookPages, setStoryBookPages] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'newStory' or 'generateStory'
  const [loadingDescription, setLoadingDescription] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [page, setPage] = useState(1)

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
    } else if (confirmAction === 'generateStory') {
      getGPTResponse()
    }
    setConfirmOpen(false)
    setConfirmAction(null)
  }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && prompt.trim() && !loading) {
      handleGenerateStory()
    }
  }

  const handleChange = (event, value) => setPage(value)
  const getGPTResponse = async () => {
    setLoading(true)
    setStoryBookPages([])
    setConfirmOpen(false)
    try {
      setLoadingDescription('Generating story...')
      const res = await request(`${SERVER_PREFIX}/chat/gpt/prompt/story?prompt=${prompt}`, 'GET')
      const reply = await res.text()
      const replyArr = reply.split('\n').filter(i => i)

      // Average time to generate all images is 5 seconds plus a 1 second for each image, minus 1
      const durationInSeconds = 5 + replyArr.length - 1
      const intervalTime = Math.floor((durationInSeconds * 1000) / 100) // Interval time for each 1% progress
      const interval = setInterval(() => {
        setPercentage((prevPercentage) => {
          const newPercentage = prevPercentage + 1
          if (newPercentage >= 100) {
            clearInterval(interval)
          }
          return newPercentage
        })
      }, intervalTime)

      setLoadingDescription(`Generating image${replyArr.length > 1 ? 's' : ''}...`)
      const replyImgArr = await Promise.all(replyArr.map(async (text, index) => {
        const imageRes = await request(`${SERVER_PREFIX}/chat/gpt/image/prompt?prompt=${replyArr[index - 1]}${text}`, 'GET')
        const image = await imageRes.text()
        return {
          id: v4(),
          reply: text,
          image
        }
      }))
      clearInterval(interval)
      setPercentage(0)
      setStoryBookPages(replyImgArr)
    } catch (ex) {
      console.log(ex)
    }
    setLoading(false)
  }

  return (
    <ContentWrapper title='Story Book'>
      {/* Input Section - Show only when no story exists (not when loading if story exists) */}
      {storyBookPages.length === 0 && (
        <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <div className="flex items-center space-x-4 mb-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
              </svg>
            </div>
            <div>
              <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                AI Story Generator
              </h2>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                Create immersive stories with AI-generated text, images, and voice narration
              </p>
            </div>
          </div>

          {/* Input Section */}
          <div className='space-y-4'>
            <div className='relative'>
              <InputWrapper
                label='What story would you like to hear about?'
                value={prompt}
                setValue={setPrompt}
                onKeyDown={handleKeyDown}
                className="pr-12"
              />
              {prompt && (
                <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
                  <button
                    className={`p-2 rounded-lg transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:text-red-400 hover:bg-red-500/10' : 'text-theme-secondary-light hover:text-red-500 hover:bg-red-500/10'}`}
                    onClick={handleClearClick}
                    disabled={loading}
                    title="Clear input"
                  >
                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                      <path fillRule='evenodd' d='M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z' clipRule='evenodd' />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {prompt && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 shadow-lg disabled:opacity-50 ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleGenerateStory()
                  }}
                  disabled={loading || !prompt.trim()}
                  title="Generate story"
                >
                  {loading ? (
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <LoadingSpinner svgClassName='!h-4 !w-4' />
                      <span className="hidden sm:inline">Generating...</span>
                      <span className="sm:hidden">...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                        <path d='M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z' />
                      </svg>
                      <span className="hidden sm:inline">Generate Story</span>
                      <span className="sm:hidden">Generate</span>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={confirmAction === 'newStory' ? 'New Story' : 'Generate New Story'}
        message={confirmAction === 'newStory'
          ? 'Are you sure you want to start a new story? This will clear the current story.'
          : 'Are you sure you want to generate a new story? This will replace the current story.'
        }
        confirmFunc={handleConfirm}
        cancelFunc={() => {
          setConfirmOpen(false)
          setConfirmAction(null)
        }}
      />
      {/* Loading Progress */}
      {loading && (
        <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'} shadow-2xl`}>
          <div className="flex items-center space-x-4 mb-6">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'} shadow-lg`}>
              <LoadingSpinner svgClassName={`!h-8 !w-8 ${isDark ? '!text-gray-900' : '!text-white'}`} />
            </div>
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {loadingDescription}
              </h3>
              <p className={`text-base font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Please wait while we create your story...
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className='flex justify-between items-center'>
              <span className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</span>
              <span className={`text-lg font-bold px-3 py-1 rounded-lg ${isDark ? 'text-gray-900 bg-accent-dark' : 'text-white bg-accent-light'}`}>{percentage}%</span>
            </div>
            <div className={`w-full rounded-full h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} shadow-inner`}>
              <div
                className={`h-4 rounded-full transition-all duration-500 shadow-sm ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Story Display */}
      {storyBookPages.length > 0 && (
        <div className={`rounded-2xl overflow-hidden transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          {/* Story Header */}
          <div className={`px-4 sm:px-8 py-4 sm:py-6 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
                  <svg className={`w-6 h-6 ${isDark ? 'text-gray-900' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                    Your Story
                  </h3>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                    Page {page} of {storyBookPages.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <button
                  onClick={handleNewStoryClick}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'} border ${isDark ? 'border-white/20' : 'border-black/20'}`}
                >
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-4 h-4'>
                      <path fillRule="evenodd" d='M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5H12.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z' clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">New Story</span>
                    <span className="sm:hidden">New</span>
                  </div>
                </button>
                <AudioStreamPlayerSelector prompt={storyBookPages[page - 1].reply} />
              </div>
            </div>
          </div>

          {/* Story Content */}
          <div className="p-4 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Story Text */}
              <div className="lg:col-span-2 space-y-4">
                <div className={`prose prose-lg max-w-none ${isDark ? 'prose-invert' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className={`text-base leading-relaxed ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                    {storyBookPages[page - 1].reply}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Story Image */}
              <div className="lg:col-span-1">
                {storyBookPages[page - 1].image && (
                  <div className="sticky top-8">
                    <div className={`rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-2xl ${isDark ? 'ring-1 ring-white/10' : 'ring-1 ring-black/10'}`}>
                      <img
                        alt='Generated story illustration'
                        className='w-full h-auto object-cover'
                        src={`data:image/png;base64,${storyBookPages[page - 1].image}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination */}
            {storyBookPages.length > 1 && (
              <div className={`flex justify-center mt-12 pt-8 border-t ${isDark ? 'border-white/20' : 'border-black/20'}`}>
                <nav className="flex items-center space-x-2">
                  {Array.from({ length: storyBookPages.length }).map((_, index) => (
                    <button
                      key={index}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        index + 1 === page
                          ? isDark
                            ? 'btn-primary-dark'
                            : 'btn-primary-light'
                          : isDark
                            ? 'text-theme-dark hover:bg-white/10 border border-white/20'
                            : 'text-theme-light hover:bg-black/10 border border-black/20'
                      }`}
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
