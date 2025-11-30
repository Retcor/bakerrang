import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const ProductCounter = ({ product, incrementer, decrementer }) => {
  const { isDark } = useTheme()

  return (
    <div className={`p-4 rounded-xl transition-all duration-300 border hover:scale-105 ${product.count > 0 ? isDark ? 'bg-accent-dark/20 border-accent-dark/50' : 'bg-accent-light/20 border-accent-light/50' : isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-black/5 border-black/10 hover:bg-black/10'}`}>
      <div className="flex items-center space-x-3 mb-3">
        <div className='w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-md'>
          <img alt={product.descr} src={product.icon} title={product.descr} className='w-full h-full object-cover' />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm truncate ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
            {product.descr}
          </h4>
          {product.count > 0 && (
            <p className={`text-xs ${isDark ? 'text-accent-dark' : 'text-accent-light'} font-medium`}>
              {product.count} in cart
            </p>
          )}
        </div>
      </div>

      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${product.count === 0 ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'} border ${isDark ? 'border-white/20' : 'border-black/20'}`}
            onClick={() => decrementer(product)}
            disabled={product.count === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className={`min-w-[2rem] text-center font-bold text-lg ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
            {product.count}
          </span>
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'} border ${isDark ? 'border-white/20' : 'border-black/20'}`}
            onClick={() => incrementer(product)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        {product.count > 0 && (
          <div className={`px-2 py-1 rounded-md text-xs font-medium ${isDark ? 'bg-accent-dark text-gray-900' : 'bg-accent-light text-white'}`}>
            Added
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductCounter
