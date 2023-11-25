import React, { useState } from 'react'
import LoadingSpinner from './icons/LoadingSpinner.jsx'
import GoogleLogin from './GoogleLogin.jsx'

const Login = () => {
  const [loggingIn, setLoggingIn] = useState(false)

  return (
    <div className='min-h-screen flex items-center justify-center bg-black'>
      <div className='bg-gray-800 px-8 py-6 rounded shadow-md text-center'>
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
