import React from 'react'
import google from '../assets/google-icon.png'
import { SERVER_PREFIX } from '../App.jsx'

const GoogleLogin = ({ onClick }) => {
  return (
    <a
      href={`${SERVER_PREFIX}/auth/google`}
      className='flex items-center bg-white text-gray-700 font-semibold py-2 px-4 rounded border border-gray-300 hover:bg-gray-100 focus:outline-none focus:shadow-outline-blue active:bg-gray-200'
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
