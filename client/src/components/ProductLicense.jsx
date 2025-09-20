import React from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const ProductLicense = ({ productLicense, licenses, setLicenses }) => {
  const { isDark } = useTheme()
  const toggleCheck = () => {
    licenses.includes(productLicense.licenseId)
      ? setLicenses(prev => prev.filter(l => l !== productLicense.licenseId))
      : setLicenses(prev => [...prev, productLicense.licenseId])
  }

  return (
    <div className={`p-4 cursor-pointer rounded-xl transition-all duration-200 border ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-black/5 border-black/10 hover:bg-black/10'}`} onClick={toggleCheck}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-semibold text-sm ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
          {productLicense.name}
        </h4>
        <div className="flex items-center space-x-2">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
            licenses && licenses.includes(productLicense.licenseId)
              ? isDark
                ? 'bg-green-500 border-green-500'
                : 'bg-green-500 border-green-500'
              : isDark
                ? 'border-gray-600'
                : 'border-gray-400'
          }`}>
            {licenses && licenses.includes(productLicense.licenseId) && (
              <svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' stroke='currentColor' className='w-3 h-3 text-white stroke-2'>
                <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
              </svg>
            )}
          </div>
          <span className={`text-xs font-medium ${
            licenses && licenses.includes(productLicense.licenseId)
              ? 'text-green-500'
              : isDark
                ? 'text-gray-400'
                : 'text-gray-600'
          }`}>
            {licenses && licenses.includes(productLicense.licenseId) ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-2">
        {productLicense.products.map(p => (
          <div key={p.descr.replace(/[^a-zA-Z0-9]/g, '')} className="flex items-center space-x-3">
            <div className="w-6 h-6 flex-shrink-0 rounded overflow-hidden">
              <img alt={p.descr} src={p.icon} title={p.descr} className='w-full h-full object-cover' />
            </div>
            <span className={`text-xs ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              {p.descr}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProductLicense
