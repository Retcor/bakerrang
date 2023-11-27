import React from 'react'

const ContentWrapper = ({ children, title }) => {
  return (
    <div className='bg-gray-800 p-8 m-4 rounded-lg'>
      <h2 className='text-4xl text-white font-black mb-2'>{title}</h2>
      {children}
    </div>
  )
}

export default ContentWrapper
