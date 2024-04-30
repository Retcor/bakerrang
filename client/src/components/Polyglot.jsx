import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { languages } from '../constants/index.js'
import { request } from '../utils/index.js'
import { Dropdown, LoadingSpinner, SpeechToText } from './index.js'
import ContentWrapper from './ContentWrapper.jsx'
import AudioStreamPlayerSelector from './AudioStreamPlayerSelector.jsx'

const Polyglot = () => {
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
      <p className='text-md text-white font-medium'>
        Polyglot: knowing or using several languages. This functionality strives to allow
        communication across languages. Just type or speak what you want to be said, select the language and
        hear it spoken in your voice.  Imagine if we all had a tool like this, how quickly we could
        bridge the language divide!
      </p>
      <div className='flex justify-center mt-8'>
        <div className='flex space-x-8'>
          <Dropdown options={langNameList} setSelectedOption={setSelectedInputOption} selectedOption={selectedInputOption} />
          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' onClick={swapLanguages} className='mt-2 w-6 h-6 cursor-pointer hover:text-blue-500'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' />
          </svg>
          <Dropdown options={langNameList} setSelectedOption={setSelectedOutputOption} selectedOption={selectedOutputOption} />
        </div>
      </div>
      <div className='lg:flex'>
        <div className='lg:w-5/12 mt-4'>
          <SpeechToText speechToText={speechToText} setSpeechToText={setSpeechToText} lang={inputLangCode} />
        </div>
        <div className='lg:w-2/12 mt-4 flex flex-col items-center'>
          <button
            className='lg:mt-11'
            onClick={handleTranslate}
            disabled={translationLoading}
          >
            {translationLoading
              ? (
                <div className='flex items-center justify-center'>
                  <LoadingSpinner />
                </div>
                )
              : (
                <span className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'>Translate</span>
                )}
          </button>
        </div>
        <div className='lg:w-5/12 mt-4 flex flex-col relative'>
          <textarea
            onChange={(e) => setTranslation(e.target.value)}
            className='bg-gray-700 py-4 px-6 placeholder:text-secondary h-32 text-white rounded-lg outline-none border-none font-medium resize-none'
            value={translation}
          />
          {translation && (
            <div className='absolute right-1 top-3 flex items-center'>
              <AudioStreamPlayerSelector prompt={translation} />
            </div>
          )}
        </div>
      </div>
    </ContentWrapper>
  )
}

export default Polyglot
