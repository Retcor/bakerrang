import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { languages } from '../constants/index.js'
import { request } from '../utils/index.js'
import { Dropdown } from './index.js'
import ContentWrapper from './ContentWrapper.jsx'
import Microphone from './Microphone.jsx'

const PolyglotInstant = () => {
  const [speechToText, setSpeechToText] = useState('')
  const [translation, setTranslation] = useState('')
  const [translationLoading, setTranslationLoading] = useState(false)
  const langNameList = languages.map(language => language.name)
  const [inputLangCode, setInputLangCode] = useState(languages[0].code)
  const [outputLang, setOutputLang] = useState(langNameList[0])

  useEffect(() => {
    // FIXME: Need to fix to ensure this isn't called for each detection but only upon finishing of speechToText
    // TODO: perform translation and then play the translation
    if (speechToText) {
      console.log(`speechToText changed: ${speechToText}`)
    }
  }, [speechToText])

  const handleTranslate = async () => {
    setTranslationLoading(true)
    const res = await request(`${SERVER_PREFIX}/chat/gpt/translate?prompt=${speechToText}&language=${outputLang}`, 'GET')
    setTranslation(await res.text())
    setTranslationLoading(false)
  }

  const handleInputLangChange = newLangName => {
    const langObj = languages.find(l => l.name === newLangName)
    setInputLangCode(langObj.code)
  }

  return (
    <ContentWrapper title='Polyglot Instant'>
      <p className='text-md text-white font-medium'>
        Polyglot but instant! <span className='text-[#D4ED31]'>(Under Construction)</span>
      </p>
      <div className='flex justify-center mt-8'>
        <div className='flex md:space-x-12 xs:space-x-4'>
          <Dropdown options={langNameList} defaultOption={langNameList[0]} onChange={handleInputLangChange} />
          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='mt-2 w-6 h-6'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' />
          </svg>
          <Dropdown options={langNameList} defaultOption={langNameList[0]} onChange={setOutputLang} />
        </div>
      </div>
      <div className='lg:flex'>
        <div className='lg:w-5/12 mt-4'>
          <Microphone setSpeechToText={setSpeechToText} lang={inputLangCode} />
        </div>
      </div>
    </ContentWrapper>
  )
}

export default PolyglotInstant
