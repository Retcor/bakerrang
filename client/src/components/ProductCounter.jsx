import React from 'react'

const ProductCounter = ({ product, incrementer, decrementer }) => {
  return (
    <div className='flex justify-between items-center bg-gray-700 p-2 shadow-lg rounded-lg my-2 w-full md:w-1/2 lg:w-1/3'>
      <div className='w-8 h-8 flex-shrink-0'>
        <img alt={product.descr} src={product.icon} title={product.descr} className='w-full h-full object-cover' />
      </div>
      <span className='font-medium text-white'>{product.descr}</span>
      <div className='flex items-center'>
        <button
          className='text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md'
          onClick={() => decrementer(product)}
          disabled={product.count === 0}
        >
          -
        </button>
        <span className='mx-4'>{product.count}</span>
        <button
          className='text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md'
          onClick={() => incrementer(product)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default ProductCounter
