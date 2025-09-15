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
  const [loadingDescription, setLoadingDescription] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [page, setPage] = useState(1)

  const handleClearClick = () => setPrompt('')
  const handleGenerateStory = async () => {
    if (storyBookPages.length) {
      setConfirmOpen(true)
    } else {
      await getGPTResponse()
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
      <p className={`text-xs font-medium ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
        Story Book generates random Story Books with AI generated text,
        images and voice cloning.  This allows for a fun and
        creative way to read all new types of stories!
      </p>
      <div className='mt-8 flex flex-col gap-4'>
        <ConfirmModal
          open={confirmOpen}
          title='Confirmation'
          message='Are you sure you want to generate a new story? This will replace the current story.'
          confirmFunc={getGPTResponse}
          cancelFunc={() => setConfirmOpen(false)}
        />
        <div className='relative flex flex-col'>
          <InputWrapper label='What story would you like to hear about today?' value={prompt} setValue={setPrompt} />
          {prompt && (
            <div className='absolute right-3 bottom-2 flex items-center'>
              <button
                className={`mr-2 transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:text-red-400' : 'text-theme-secondary-light hover:text-red-500'}`}
                onClick={handleClearClick}
                disabled={loading}
              >
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-5 h-5'>
                  <path fillRule='evenodd' d='M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z' clipRule='evenodd' />
                </svg>
              </button>
              <button
                className={`transition-all duration-200 ${isDark ? 'text-theme-secondary-dark hover:text-blue-400' : 'text-theme-secondary-light hover:text-blue-500'}`}
                onClick={handleGenerateStory}
                disabled={loading}
              >
                {loading
                  ? <LoadingSpinner svgClassName='!h-5 !w-5' />
                  : (
                    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-5 h-5'>
                      <path d='M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z' />
                    </svg>
                    )}
              </button>
            </div>
          )}
        </div>
      </div>
      {loading && (
        <div>
          <br />
          <div className='flex justify-between mb-1'>
            <span className='text-base font-medium text-[#D4ED31]'>{loadingDescription}</span>
            <span className='text-sm font-medium text-[#D4ED31]'>{percentage}%</span>
          </div>
          <div className={`w-full rounded-full h-2.5 ${isDark ? 'bg-white/20' : 'bg-black/20'}`}>
            <div className='bg-[#D4ED31] h-2.5 rounded-full transition-all duration-300' style={{ width: `${percentage}%` }} />
          </div>
        </div>
      )}
      <br />
      <div>
        {storyBookPages.length > 0 && (
          <div className={`p-6 rounded-lg transition-all duration-300 ${isDark ? 'glass-light' : 'glass-dark'}`}>
            <div className='flex'>
              <div className='flex-none w-50 pt-1'>
                <AudioStreamPlayerSelector prompt={storyBookPages[page - 1].reply} />
              </div>
              <div className='grow px-2'>
                <div
                  className={`text-sm md:text-lg mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {storyBookPages[page - 1].reply}
                  </ReactMarkdown>
                </div>
              </div>
              <div className='flex-none w-36 md:w-64'>
                {storyBookPages[page - 1].image && (
                  <img
                    alt='No Image canneth be foundest'
                    className='rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl'
                    src={`data:image/png;base64,${storyBookPages[page - 1].image}`}
                  />
                )}
              </div>
            </div>
            <div className='flex items-start justify-center mt-1'>
              <nav className='Pagination'>
                <ul className='flex pl-0 list-none rounded mt-4'>
                  {Array.from({ length: storyBookPages.length }).map((_, index) => (
                    <li key={index}>
                      <button
                        className={`px-3 py-2 mx-1 rounded transition-all duration-200 ${
                          index + 1 === page
                            ? 'bg-[#D4ED31] text-gray-800 shadow-lg'
                            : isDark
                              ? 'glass-dark text-theme-dark hover:bg-[#D4ED31] hover:text-gray-800'
                              : 'glass-light text-theme-light hover:bg-[#D4ED31] hover:text-gray-800'
                        }`}
                        onClick={() => handleChange(null, index + 1)}
                      >
                        {index + 1}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        )}
      </div>
    </ContentWrapper>
  )
}

export default StoryBook
