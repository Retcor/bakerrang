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
      <div className='absolute right-2 top-2 flex items-center'>
        <Microphone setSpeechToText={setSpeechToText} lang={lang} />
      </div>
    </div>
  )
}

export default SpeechToText
