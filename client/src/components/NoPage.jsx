import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const NoPage = () => {
  const { isDark } = useTheme()

  return (
    <div className={`min-h-screen flex items-center justify-center theme-bg ${isDark ? 'dark-theme-bg' : 'light-theme-bg'}`}>
      <div className={`p-8 rounded-lg text-center transition-all duration-300 ${isDark ? 'glass-card-dark glass-hover-dark' : 'glass-card-light glass-hover-light'}`}>
        <h1 className={`text-6xl font-black mb-4 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>404</h1>
        <p className={`text-lg ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>Page not found</p>
      </div>
    </div>
  )
}

export default NoPage
