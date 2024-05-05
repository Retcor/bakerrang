import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { languages } from '../constants/index.js'
import { getTextToSpeechAudioSrc, request } from '../utils/index.js'
import { AudioStreamPlayer, Dropdown } from './index.js'
import ContentWrapper from './ContentWrapper.jsx'
import Microphone from './Microphone.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'

const PolyglotInstant = () => {
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
      <p className='text-xs text-white font-medium'>
        Polyglot but instant! Voice used will be the primary voice set in the <a href="/account" className="text-blue-400 hover:text-blue-500 hover:underline">Account settings</a> or the first voice found if there is no primary.
      </p>
      <div className='flex justify-center mt-8'>
        <div className='flex space-x-8'>
          <Dropdown options={langNameList} setSelectedOption={setSelectedInputOption} selectedOption={selectedInputOption} dropdownClassname='left-0' />
          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' onClick={swapLanguages} className='mt-2 w-6 h-6 cursor-pointer hover:text-blue-500'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' />
          </svg>
          <Dropdown options={langNameList} setSelectedOption={setSelectedOutputOption} selectedOption={selectedOutputOption} />
        </div>
      </div>
      <div className='flex justify-center mt-4'>
        <div className='w-full flex justify-center'>
          <Microphone setSpeechToText={setSpeechToText} lang={inputLangCode} buttonClassName='!w-64 !h-64' isLoading={isProcessing} />
          <AudioStreamPlayer audioSrc={audioSrc} controlTrigger={controlTrigger} />
        </div>
      </div>
    </ContentWrapper>
  )
}

export default PolyglotInstant
