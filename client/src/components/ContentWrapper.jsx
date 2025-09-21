import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const ContentWrapper = ({ children, title }) => {
  const { isDark } = useTheme()

  return (
    <div className={`p-8 m-4 rounded-lg transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'}`}>
      <h2 className={`text-4xl font-black mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{title}</h2>
      {children}
    </div>
  )
}

export default ContentWrapper
