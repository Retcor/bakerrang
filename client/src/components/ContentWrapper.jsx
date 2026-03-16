import React from 'react'

const ContentWrapper = ({ children }) => {
  return (
    <div className='p-4 sm:p-8'>
      {children}
    </div>
  )
}

export default ContentWrapper
