import React, { useState } from 'react'

const Dropdown = ({ options, selectedOption, setSelectedOption, dropdownClassname }) => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  const handleOptionClick = (option) => {
    setSelectedOption(option)
    setIsOpen(false)
  }

  return (
    <div className='relative inline-block text-left'>
      <div>
        <button
          type='button'
          className='inline-flex justify-between w-full rounded-md text-gray font-bold bg-blue-500 px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
          id='options-menu'
          aria-haspopup='true'
          aria-expanded='true'
          onClick={toggleDropdown}
        >
          {selectedOption}
          <svg
            className='-mr-1 ml-2 h-5 w-5'
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 20 20'
            fill='currentColor'
            aria-hidden='true'
          >
            <path
              fillRule='evenodd'
              d='M6.293 6.293a1 1 0 011.414 0L10 8.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z'
              clipRule='evenodd'
            />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className={`z-10 origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg text-gray font-bold bg-gray-700 border border-gray-600 ring-1 ring-black ring-opacity-5 max-h-[20rem] overflow-auto ${dropdownClassname}`}>
          <div
            className='py-1'
            role='menu'
            aria-orientation='vertical'
            aria-labelledby='options-menu'
          >
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                className='block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 hover:text-gray-900'
                role='menuitem'
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dropdown
