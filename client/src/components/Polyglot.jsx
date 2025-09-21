import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { languages } from '../constants/index.js'
import { request } from '../utils/index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { Dropdown, LoadingSpinner, SpeechToText } from './index.js'
import ContentWrapper from './ContentWrapper.jsx'
import AudioStreamPlayerSelector from './AudioStreamPlayerSelector.jsx'

const Polyglot = () => {
  const { isDark } = useTheme()
  const [speechToText, setSpeechToText] = useState('')
  const [translation, setTranslation] = useState('')
  const [translationLoading, setTranslationLoading] = useState(false)
  const langNameList = languages.map(language => language.name)
  const [inputLangCode, setInputLangCode] = useState(languages[0].code)
  const [selectedInputOption, setSelectedInputOption] = useState(langNameList[0])
  const [selectedOutputOption, setSelectedOutputOption] = useState(langNameList[0])

  useEffect(() => {
    if (selectedInputOption) {
      const langObj = languages.find(l => l.name === selectedInputOption)
      setInputLangCode(langObj.code)
    }
  }, [selectedInputOption])

  const handleTranslate = async () => {
    setTranslationLoading(true)
    const res = await request(`${SERVER_PREFIX}/chat/gpt/translate?prompt=${speechToText}&language=${selectedOutputOption}`, 'GET')
    setTranslation(await res.text())
    setTranslationLoading(false)
  }

  const swapLanguages = () => {
    const currentInput = `${selectedInputOption}`
    const currentOutput = `${selectedOutputOption}`
    setSelectedInputOption(currentOutput)
    setSelectedOutputOption(currentInput)
  }

  return (
    <ContentWrapper title='Polyglot'>
      {/* Hero Section */}
      <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className='flex items-center space-x-4 mb-6'>
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
            <svg className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`} fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129'/>
            </svg>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              AI Language Translator
            </h2>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Break down language barriers with real-time translation and voice synthesis
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              {langNameList.length}
            </div>
            <div className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Supported Languages
            </div>
          </div>
          <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Real-time
            </div>
            <div className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Translation Speed
            </div>
          </div>
          <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Voice
            </div>
            <div className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Synthesis Available
            </div>
          </div>
        </div>
      </div>

      {/* Translation Interface */}
      <div className={`rounded-2xl p-8 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <h3 className={`text-xl font-bold mb-8 text-center ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
          Translation Workspace
        </h3>

        {/* Language Selection Bar */}
        <div className={`rounded-xl p-4 mb-8 ${isDark ? 'bg-white/35' : 'bg-black/35'}`}>
          <div className='flex items-center justify-center space-x-8'>
            <div className='flex items-center space-x-3'>
              <span className={`text-sm font-medium ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>From:</span>
              <Dropdown options={langNameList} setSelectedOption={setSelectedInputOption} selectedOption={selectedInputOption} dropdownClassname='left-0' />
            </div>

            <button
              onClick={swapLanguages}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${isDark ? 'bg-white/10 hover:bg-white/20 text-theme-dark' : 'bg-black/10 hover:bg-black/20 text-theme-light'} hover:scale-110 active:scale-95`}
              title='Swap languages'
            >
              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2' stroke='currentColor' className='w-6 h-6'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' />
              </svg>
            </button>

            <div className='flex items-center space-x-3'>
              <span className={`text-sm font-medium ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>To:</span>
              <Dropdown options={langNameList} setSelectedOption={setSelectedOutputOption} selectedOption={selectedOutputOption} />
            </div>
          </div>
        </div>

        {/* Translation Area */}
        <div className='space-y-6'>
          {/* Input Section */}
          <div>
            <div className='flex items-center justify-between mb-3'>
              <h4 className={`text-lg font-semibold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                {selectedInputOption} Input
              </h4>
              <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-white/10 text-theme-secondary-dark' : 'bg-black/10 text-theme-secondary-light'}`}>
                Type or speak
              </span>
            </div>
            <div className={`rounded-xl border-2 transition-all duration-300 ${isDark ? 'border-white/20 bg-white/15' : 'border-black/20 bg-black/15'}`}>
              <SpeechToText speechToText={speechToText} setSpeechToText={setSpeechToText} lang={inputLangCode} />
            </div>
          </div>

          {/* Translate Button */}
          <div className='flex justify-center py-4'>
            <button
              onClick={handleTranslate}
              disabled={translationLoading || !speechToText.trim()}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                isDark ? 'bg-accent-dark text-gray-900 hover:bg-accent-dark/90 shadow-accent-dark/20' : 'bg-accent-light text-white hover:bg-accent-light/90 shadow-accent-light/20'
              }`}
            >
              {translationLoading ? (
                <div className='flex items-center space-x-3'>
                  <svg className='w-6 h-6 animate-spin' fill='none' viewBox='0 0 24 24'>
                    <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                    <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                  </svg>
                  <span>Translating...</span>
                </div>
              ) : (
                <div className='flex items-center space-x-3'>
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'/>
                  </svg>
                  <span>Translate</span>
                </div>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div>
            <div className='flex items-center justify-between mb-3 min-h-[2.5rem]'>
              <h4 className={`text-lg font-semibold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                {selectedOutputOption} Translation
              </h4>
              <div className='flex items-center space-x-3'>
                {translation ? (
                  <>
                    <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-accent-dark/20 text-accent-dark' : 'bg-accent-light/20 text-accent-light'}`}>
                      Ready to listen
                    </span>
                    <AudioStreamPlayerSelector prompt={translation} />
                  </>
                ) : (
                  <div className='h-8'></div>
                )}
              </div>
            </div>
            <div className={`rounded-xl border-2 transition-all duration-300 ${isDark ? 'border-white/20 bg-white/15' : 'border-black/20 bg-black/15'}`}>
              <textarea
                onChange={(e) => setTranslation(e.target.value)}
                className={`w-full py-6 px-6 h-40 rounded-xl outline-none border-none font-medium resize-none transition-all duration-300 bg-transparent text-lg ${isDark ? 'text-theme-dark placeholder:text-theme-secondary-dark' : 'text-theme-light placeholder:text-theme-secondary-light'}`}
                value={translation}
                placeholder='Your translation will appear here...'
              />
            </div>
          </div>
        </div>
      </div>
    </ContentWrapper>
  )
}

export default Polyglot
