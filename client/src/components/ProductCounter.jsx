import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const ProductCounter = ({ product, incrementer, decrementer }) => {
  const { isDark } = useTheme()

  return (
    <div className={`flex justify-between items-center p-2 shadow-lg rounded-lg my-2 w-full md:w-1/2 lg:w-1/3 transition-all duration-300 ${isDark ? 'glass-card-dark glass-hover-dark' : 'glass-card-light glass-hover-light'}`}>
      <div className='w-8 h-8 flex-shrink-0'>
        <img alt={product.descr} src={product.icon} title={product.descr} className='w-full h-full object-cover rounded' />
      </div>
      <span className={`font-medium ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{product.descr}</span>
      <div className='flex items-center'>
        <button
          className={`px-3 py-1 rounded-md transition-all duration-200 ${product.count === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
          onClick={() => decrementer(product)}
          disabled={product.count === 0}
        >
          -
        </button>
        <span className={`mx-4 font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>{product.count}</span>
        <button
          className={`px-3 py-1 rounded-md transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
          onClick={() => incrementer(product)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default ProductCounter
