import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const checkLogin = async () => {
      const res = await request(`${SERVER_PREFIX}/auth/check`, 'GET')
      const newAuth = await res.json()
      setAuth(newAuth)
    }

    checkLogin() // Call immediately upon page load

    const intervalId = setInterval(checkLogin, 30000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (auth) {
      if (auth.isAuthenticated) {
        if (window.location.href.includes('/login')) {
          navigate('/')
        }
      } else {
        navigate('/login')
      }
    }
  }, [auth])

  const logout = async () => {
    await request(`${SERVER_PREFIX}/auth/logout`, 'GET')
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ auth, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
