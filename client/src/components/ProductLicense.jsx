import React from 'react'

const ProductLicense = ({ productLicense, licenses, setLicenses }) => {
  const toggleCheck = () => {
    licenses.includes(productLicense.licenseId)
      ? setLicenses(prev => prev.filter(l => l !== productLicense.licenseId))
      : setLicenses(prev => [...prev, productLicense.licenseId])
  }

  return (
    <div className='flex items-center space-x-2 p-2 cursor-pointer my-2 mx-2 bg-gray-700 rounded-[7px] w-full md:w-1/3 lg:w-1/4 xl:w-1/5' onClick={toggleCheck}>
      <div className='w-6 h-6 relative flex justify-center items-center pr-2'>
        {licenses && licenses.includes(productLicense.licenseId) && (
          <svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' stroke='currentColor' className='w-4 h-4 text-green-500'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
          </svg>
        )}
        <div className='absolute top-0 right-0 bottom-0 w-px bg-gray-400' />
      </div>
      <div className='flex-1 text-white text-xs'>
        <ul>
          {productLicense.products.map(p => (
            <li key={p.descr.replace(/[^a-zA-Z0-9]/g, '')} className='flex items-center space-x-2'>
              <div className='w-8 h-8 flex-shrink-0'>
                <img alt={p.descr} src={p.icon} title={p.descr} className='w-full h-full object-cover' />
              </div>
              <span>{p.descr}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ProductLicense
