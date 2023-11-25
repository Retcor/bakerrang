import React, { useState } from 'react'
import SpeechToText from './SpeechToText.jsx'
import LoadingSpinner from './icons/LoadingSpinner.jsx'
import AudioStreamPlayer from './AudioStreamPlayer.jsx'
import { SERVER_PREFIX } from '../App.jsx'
import Dropdown from './Dropdown.jsx'
import { languages } from '../constants/index.js'
import { request } from '../utils/fetchUtils.js'

const Polyglot = () => {
  const [speechToText, setSpeechToText] = useState('')
  const [translation, setTranslation] = useState('')
  const [translationLoading, setTranslationLoading] = useState(false)
  const langNameList = languages.map(language => language.name)
  const [inputLangCode, setInputLangCode] = useState(languages[0].code)
  const [outputLang, setOutputLang] = useState(langNameList[0])

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
    <div className='bg-gray-800 p-8 m-4 rounded-lg'>
      <h2 className='text-4xl text-white font-black'>Polyglot</h2>
      <p className='mt-2 text-md text-white font-medium'>
        Polyglot: knowing or using several languages. This functionality strives to allow
        communication across languages. Just type or speak what you want to be said, select the language and
        hear it spoken in your voice.  Imagine if we all had a tool like this, how quickly we could
        bridge the language divide!
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
                <span className='text-gray bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'>Translate</span>
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
              <AudioStreamPlayer prompt={translation} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Polyglot
