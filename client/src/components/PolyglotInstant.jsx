import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { languages } from '../constants/index.js'
import { getTextToSpeechAudioSrc, request } from '../utils/index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { AudioStreamPlayer, Dropdown } from './index.js'
import ContentWrapper from './ContentWrapper.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'
import GoogleSpeechToText from './GoogleSpeechToText.jsx'

const PolyglotInstant = () => {
  const { isDark } = useTheme()
  const [speechToText, setSpeechToText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const langNameList = languages.map(language => language.name)
  const [inputLangCode, setInputLangCode] = useState(languages[0].code)
  const [selectedInputOption, setSelectedInputOption] = useState(langNameList[0])
  const [selectedOutputOption, setSelectedOutputOption] = useState(langNameList[0])
  const [audioSrc, setAudioSrc] = useState(null)
  const [controlTrigger, setControlTrigger] = useState(null)
  const { voices } = useAppContext()

  useEffect(() => {
    if (speechToText) {
      // Speech to text resolved, now translate
      console.log(`SpeechToText changed: ${speechToText}`)
      setIsProcessing(true)
      handleTranslate()
    }
  }, [speechToText])

  useEffect(() => {
    if (selectedInputOption) {
      const langObj = languages.find(l => l.name === selectedInputOption)
      setInputLangCode(langObj.code)
    }
  }, [selectedInputOption])

  const handleTranslate = async () => {
    const res = await request(`${SERVER_PREFIX}/chat/gpt/translate?prompt=${speechToText}&language=${selectedOutputOption}`, 'GET')
    const translation = await res.text()

    if (voices?.length > 0) {
      const audioSrc = await getTextToSpeechAudioSrc(translation, voices.find(p => p.isPrimary)?.id || voices[0].id)
      setAudioSrc(audioSrc)
      setControlTrigger('PLAY')
    }

    setIsProcessing(false)
  }

  const swapLanguages = () => {
    const currentInput = `${selectedInputOption}`
    const currentOutput = `${selectedOutputOption}`
    setSelectedInputOption(currentOutput)
    setSelectedOutputOption(currentInput)
  }

  return (
    <ContentWrapper title='Polyglot Instant'>
      {/* Hero Section */}
      <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className='flex items-center space-x-4 mb-6'>
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
            <svg className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`} fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M19 14l-7 7m0 0l-7-7m7 7V3'/>
            </svg>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Instant Voice Translator
            </h2>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Quick real-time translation for face-to-face conversations
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              One-Click
            </div>
            <div className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Simple Operation
            </div>
          </div>
          <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Instant
            </div>
            <div className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Audio Translation
            </div>
          </div>
          <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              {langNameList.length}
            </div>
            <div className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Languages
            </div>
          </div>
        </div>
      </div>

      {/* Translation Interface */}
      <div className={`rounded-2xl p-6 sm:p-8 lg:p-12 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <h3 className={`text-lg sm:text-xl font-bold mb-3 text-center ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
          Translation Control Center
        </h3>
        <p className={`text-xs sm:text-sm text-center mb-6 sm:mb-8 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
          Uses {voices?.find(v => v.isPrimary)?.name || voices?.[0]?.name || 'default'} voice •
          <a href='/account' className='text-blue-400 hover:text-blue-500 hover:underline transition-all duration-200 ml-1'>
            Change in Account
          </a>
        </p>

        {/* Language Selection */}
        <div className={`rounded-xl p-4 sm:p-6 mb-8 sm:mb-12 ${isDark ? 'bg-white/35' : 'bg-black/35'}`}>
          <div className='flex items-center justify-center space-x-4 sm:space-x-8'>
            <Dropdown options={langNameList} setSelectedOption={setSelectedInputOption} selectedOption={selectedInputOption} dropdownClassname='left-0' />

            <button
              onClick={swapLanguages}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${isDark ? 'bg-white/10 hover:bg-white/20 text-theme-dark' : 'bg-black/10 hover:bg-black/20 text-theme-light'} hover:scale-110 active:scale-95`}
              title='Swap languages'
            >
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor' className='w-6 h-6'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' />
              </svg>
            </button>

            <Dropdown options={langNameList} setSelectedOption={setSelectedOutputOption} selectedOption={selectedOutputOption} />
          </div>
        </div>

        {/* Microphone Control */}
        <div className='flex flex-col items-center pb-8'>
          <div className='relative mb-4'>
            <GoogleSpeechToText
              setSpeechToText={setSpeechToText}
              lang={inputLangCode}
              buttonClassName='!w-40 !h-40 sm:!w-48 sm:!h-48'
              isLoading={isProcessing}
            />
            <AudioStreamPlayer audioSrc={audioSrc} controlTrigger={controlTrigger} />
          </div>

          {/* Status indicator */}
          {isProcessing && (
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${isDark ? 'bg-accent-dark/20 text-accent-dark' : 'bg-accent-light/20 text-accent-light'}`}>
              Processing translation...
            </div>
          )}
        </div>
      </div>
    </ContentWrapper>
  )
}

export default PolyglotInstant
