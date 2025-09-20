import React, { useEffect } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const ConfirmModal = ({ message, title, open, cancelFunc, confirmFunc }) => {
  const { isDark } = useTheme()

  useEffect(() => {
    if (open) {
      // Disable background scrolling with more specific properties
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.height = '100%'
    } else {
      // Re-enable background scrolling
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.height = ''
    }

    // Cleanup function to restore scrolling
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.height = ''
    }
  }, [open])

  return (
    <>
      {open && (
        <div className='fixed inset-0 z-50 flex justify-center items-start pt-[20vh] p-4' style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
          <div className='fixed inset-0 bg-black/50 backdrop-blur-sm' />
          <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative z-10 transition-all duration-300 ${isDark ? 'glass-card-dark border border-white/10' : 'glass-card-light border border-black/10'}`}>
            <h2 className={`text-xl font-medium mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{title}</h2>
            <p className={`mb-4 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              {message}
            </p>
            <div className='flex justify-end space-x-3'>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-gray-800 border border-gray-600' : 'text-theme-light hover:bg-gray-100 border border-gray-300'}`}
                onClick={cancelFunc}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
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
