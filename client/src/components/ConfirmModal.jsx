import React from 'react'

const ConfirmModal = ({ message, title, open, cancelFunc, confirmFunc }) => {
  return (
    <>
      {open && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div className='fixed inset-0 bg-black opacity-50' />
          <div className='bg-gray-800 w-96 p-6 rounded-lg shadow-lg relative z-10'>
            <h2 className='text-xl text-white font-medium mb-4'>{title}</h2>
            <p className='mb-4 text-white'>
              {message}
            </p>
            <div className='flex justify-end'>
              <button className='mr-2 px-4 py-2 text-white bg-gray-500 hover:bg-gray-700 rounded' onClick={cancelFunc}>
                Cancel
              </button>
              <button
                className='px-4 py-2 text-white bg-blue-500 hover:bg-blue-700 rounded'
                onClick={confirmFunc}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ConfirmModal
