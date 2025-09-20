import React from 'react'
import google from '../assets/google-icon.png'
import { SERVER_PREFIX } from '../App.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'

const GoogleLogin = ({ onClick }) => {
  const { isDark } = useTheme()

  return (
    <a
      href={`${SERVER_PREFIX}/auth/google`}
      className={`group relative w-full flex items-center justify-center font-semibold py-4 px-6 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 ${isDark ? 'glass-dark text-theme-dark hover:glass-hover-dark focus:ring-offset-gray-800' : 'glass-light text-theme-light hover:glass-hover-light focus:ring-offset-white'} shadow-lg hover:shadow-xl`}
      onClick={() => onClick()}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <img
        src={google}
        alt='Google Logo'
        className='mr-3 w-6 h-6 relative z-10'
      />
      <span className="relative z-10">Continue with Google</span>
      <svg
        className="ml-2 w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}

export default GoogleLogin
