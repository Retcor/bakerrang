import React, { createContext, useContext, useEffect, useState } from 'react'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'

const AppContext = createContext()

export const AppProvider = ({ children }) => {
  const [voices, setVoices] = useState([])

  useEffect(() => {
    request(`${SERVER_PREFIX}/text/to/speech/v1/voices`, 'GET')
      .then(response => response.json())
      .then(json => {
        setVoices(json)
      })
  }, [])

  return (
    <AppContext.Provider value={{ voices, setVoices }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
