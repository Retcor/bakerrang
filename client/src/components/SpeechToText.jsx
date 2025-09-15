import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import Microphone from './Microphone.jsx'

const SpeechToText = ({ speechToText, setSpeechToText, lang }) => {
  const { isDark } = useTheme()

  return (
    <div className='relative flex flex-col'>
      <textarea
        onChange={(e) => setSpeechToText(e.target.value)}
        className={`py-4 pr-9 px-6 h-32 rounded-lg outline-none border-none font-medium resize-none transition-all duration-300 ${isDark ? 'glass-dark text-theme-dark placeholder:text-theme-secondary-dark' : 'glass-light text-theme-light placeholder:text-theme-secondary-light'}`}
        value={speechToText}
      />
      <div className='absolute right-2 top-2 flex items-center'>
        <Microphone setSpeechToText={setSpeechToText} lang={lang} />
      </div>
    </div>
  )
}

export default SpeechToText
