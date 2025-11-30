import React, { useState } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import LoadingSpinner from './icons/LoadingSpinner.jsx'
import GoogleLogin from './GoogleLogin.jsx'

const Login = () => {
  const { isDark } = useTheme()
  const [loggingIn, setLoggingIn] = useState(false)

  return (
    <div className={`min-h-screen flex items-center justify-center theme-bg ${isDark ? 'dark-theme-bg' : 'light-theme-bg'} relative overflow-hidden`}>
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className={`absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-20 blur-3xl ${isDark ? 'bg-blue-500' : 'bg-purple-300'}`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl ${isDark ? 'bg-purple-500' : 'bg-blue-300'}`}></div>
        <div className={`absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl ${isDark ? 'bg-green-400' : 'bg-pink-300'} transform -translate-x-1/2 -translate-y-1/2`}></div>
      </div>

      {/* Main login card */}
      <div className={`relative z-10 w-full max-w-md mx-4 px-8 py-12 rounded-2xl text-center transition-all duration-300 backdrop-blur-xl ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>

        {/* Logo/Brand section */}
        <div className="mb-12">
          <h1 className={`text-4xl font-black tracking-tight mb-2 ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>BakerRang</h1>
          <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
            Building AI tools that bring people together
          </p>
        </div>

        {/* Content section */}
        <div className="space-y-6">
          <div>
            <h2 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Welcome back
            </h2>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Sign in to continue your language learning journey
            </p>
          </div>

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

      {/* Floating elements for visual interest */}
      <div className={`absolute top-20 left-20 w-2 h-2 rounded-full opacity-60 animate-pulse ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}></div>
      <div className="absolute bottom-32 left-1/3 w-1 h-1 bg-blue-400 rounded-full opacity-40 animate-pulse" style={{animationDelay: '1s'}}></div>
      <div className="absolute top-1/3 right-20 w-3 h-3 bg-purple-400 rounded-full opacity-50 animate-pulse" style={{animationDelay: '2s'}}></div>
    </div>
  )
}

export default Login
