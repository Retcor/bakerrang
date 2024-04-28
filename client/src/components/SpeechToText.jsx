import React from 'react'
import Microphone from './Microphone.jsx'

const SpeechToText = ({ speechToText, setSpeechToText, lang }) => {
  return (
    <div className='relative flex flex-col'>
      <textarea
        onChange={(e) => setSpeechToText(e.target.value)}
        className='bg-gray-700 py-4 pr-9 px-6 placeholder:text-secondary h-32 text-white rounded-lg outline-none border-none font-medium resize-none'
        value={speechToText}
      />
      <Microphone setSpeechToText={setSpeechToText} lang={lang} className='absolute right-3 flex items-center' />
    </div>
  )
}

export default SpeechToText
