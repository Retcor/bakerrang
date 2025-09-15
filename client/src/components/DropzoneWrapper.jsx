import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTheme } from '../providers/ThemeProvider.jsx'

const DropzoneWrapper = ({ files, setFiles }) => {
  const { isDark } = useTheme()
  const [audioPlayer, setAudioPlayer] = useState(null)
  const [filePlaying, setFilePlaying] = useState({})

  const isAudioFile = (file) => file.type.startsWith('audio/')

  const truncateFileName = (fileName, maxLength) => {
    if (fileName.length <= maxLength) {
      return fileName
    }
    return fileName.substring(0, maxLength - 4) + '...' + fileName.slice(-4)
  }

  const onDrop = useCallback((acceptedFiles) => {
    // Limit the number of files added to 3 and to audio files
    const limitedFiles = acceptedFiles
      .filter((file) => isAudioFile(file))
      .slice(0, 3)

    // Limit total files to 3, preferring the oldest added
    setFiles([...files, ...limitedFiles].slice(0, 3))
  }, [files])

  const removeFile = (fileIndex) => {
    const updatedFiles = [...files]
    updatedFiles.splice(fileIndex, 1)
    setFiles(updatedFiles)
  }

  const togglePlay = (file) => {
    if (audioPlayer) {
      if (filePlaying === file) {
        audioPlayer.pause()
        setFilePlaying({})
      } else {
        audioPlayer.src = file.preview
        audioPlayer.load()
        audioPlayer.play()
        setFilePlaying(file)
      }
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop
  })

  return (
    <>
      <div className={`border-2 p-4 cursor-pointer transition-all duration-200 rounded-lg ${
              isDragActive ? 'border-solid' : 'border-dashed'
            } ${isDark ? 'border-gray-400 glass-dark glass-hover-dark' : 'border-gray-300 glass-light glass-hover-light'}`}
      >
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <p className={`text-center text-sm ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>Drop files here, or click to select files</p>
          <p className={`text-center text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Audio files up to 10mb each. Max of 3</p>
        </div>
      </div>
      <div className='mt-2'>
        {files.map((file, index) => (
          <div key={index} className='flex items-center justify-between mb-2'>
            <span className={`mr-2 text-sm ${isDark ? 'text-[#D4ED31]' : 'text-[#8B5CF6]'}`}>{truncateFileName(file.name, 30)}</span>
            <div className='flex items-center'>
              <button
                className='mr-2'
                onClick={() => togglePlay(file)}
              >
                {filePlaying === file
                  ? (
                    <svg
                      className={`w-6 h-6 fill-current transition-colors duration-200 ${isDark ? 'text-theme-dark hover:text-blue-400' : 'text-theme-light hover:text-blue-500'}`}
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path d='M14 19h4V5h-4v14zm-6 0h4V5h-4v14z' />
                    </svg>
                    )
                  : (
                    <svg
                      className={`w-6 h-6 fill-current transition-colors duration-200 ${isDark ? 'text-theme-dark hover:text-blue-400' : 'text-theme-light hover:text-blue-500'}`}
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path d='M8 5v14l11-7z' />
                    </svg>
                    )}
              </button>
              <button
                className={`transition-colors duration-200 disabled:opacity-25 ${isDark ? 'text-theme-dark hover:text-red-400' : 'text-theme-light hover:text-red-500'}`}
                onClick={() => removeFile(index)}
                disabled={filePlaying === file}
              >
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='w-5 h-5'>
                  <path fillRule='evenodd' d='M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z' clipRule='evenodd' />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <audio
        ref={(audio) => setAudioPlayer(audio)}
        controls
        className='hidden'
        onEnded={() => setFilePlaying({})}
      />
    </>
  )
}

export default DropzoneWrapper
