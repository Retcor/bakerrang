import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const ConfirmModal = ({ message, title, open, cancelFunc, confirmFunc }) => {
  const { isDark } = useTheme()

  return (
    <>
      {open && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' />
          <div className={`w-96 p-6 rounded-lg shadow-2xl relative z-10 transition-all duration-300 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'}`}>
            <h2 className={`text-xl font-medium mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{title}</h2>
            <p className={`mb-4 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              {message}
            </p>
            <div className='flex justify-end'>
              <button
                className={`mr-2 px-4 py-2 rounded transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
                onClick={cancelFunc}
              >
                Cancel
              </button>
              <button
                className='px-4 py-2 bg-[#D4ED31] text-gray-800 rounded transition-all duration-200 hover:bg-[#c4d929] shadow-lg'
                onClick={confirmFunc}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ConfirmModal
