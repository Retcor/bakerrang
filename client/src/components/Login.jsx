import React, { useState } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import LoadingSpinner from './icons/LoadingSpinner.jsx'
import GoogleLogin from './GoogleLogin.jsx'
import logo from '../assets/bakerrang-logo.png'

const Login = () => {
  const { isDark } = useTheme()
  const [loggingIn, setLoggingIn] = useState(false)

  return (
    <div className={`min-h-screen flex items-center justify-center theme-bg ${isDark ? 'dark-theme-bg' : 'light-theme-bg'} relative overflow-hidden`}>
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className={`absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl ${isDark ? 'bg-amber-500' : 'bg-amber-200'}`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl ${isDark ? 'bg-yellow-600' : 'bg-yellow-200'}`}></div>
        <div className={`absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl ${isDark ? 'bg-orange-400' : 'bg-orange-200'} transform -translate-x-1/2 -translate-y-1/2`}></div>
      </div>

      {/* Main login card */}
      <div className={`relative z-10 w-full max-w-md mx-4 px-8 py-12 rounded-2xl text-center transition-all duration-300 backdrop-blur-xl ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>

        {/* Logo/Brand section */}
        <div className="mb-6">
          <img src={logo} alt="BakerRang" className="h-44 w-44 mx-auto" />
        </div>

        {/* Content section */}
        <div className="space-y-6">
          {loggingIn ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LoadingSpinner />
              <p className={`mt-4 text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                Signing you in...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <GoogleLogin onClick={() => setLoggingIn(true)} />

              {/* Additional info */}
              <div className={`pt-4 text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
                <p>Secure authentication powered by Google</p>
                <div className="flex items-center justify-center mt-2 space-x-1">
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>End-to-end encrypted</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
