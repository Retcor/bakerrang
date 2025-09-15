import React from 'react'
import google from '../assets/google-icon.png'
import { SERVER_PREFIX } from '../App.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'

const GoogleLogin = ({ onClick }) => {
  const { isDark } = useTheme()

  return (
    <a
      href={`${SERVER_PREFIX}/auth/google`}
      className={`flex items-center font-semibold py-2 px-4 rounded transition-all duration-200 focus:outline-none ${isDark ? 'glass-light text-gray-800 hover:bg-white/30' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
      onClick={() => onClick()}
    >
      <img
        src={google}
        alt='Google Logo'
        className='mr-2 w-6 h-6'
      />
      Login with Google
    </a>
  )
}

export default GoogleLogin
