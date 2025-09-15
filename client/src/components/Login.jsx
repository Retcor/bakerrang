import React, { useState } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import LoadingSpinner from './icons/LoadingSpinner.jsx'
import GoogleLogin from './GoogleLogin.jsx'

const Login = () => {
  const { isDark } = useTheme()
  const [loggingIn, setLoggingIn] = useState(false)

  return (
    <div className={`min-h-screen flex items-center justify-center theme-bg ${isDark ? 'dark-theme-bg' : 'light-theme-bg'}`}>
      <div className={`px-8 py-6 rounded shadow-md text-center transition-all duration-300 ${isDark ? 'glass-card-dark glass-hover-dark' : 'glass-card-light glass-hover-light'}`}>
        <h2 className='text-2xl font-black tracking-tight text-[#D4ED31] mb-4'>BakerRang</h2>
        {loggingIn
          ? (
            <div className='flex items-center justify-center'>
              <LoadingSpinner />
            </div>
            )
          : (
            <GoogleLogin onClick={() => setLoggingIn(true)} />
            )}
      </div>
    </div>
  )
}

export default Login
