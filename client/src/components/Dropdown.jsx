import React, { useState, useEffect, useRef } from 'react'
import { useTheme } from '../providers/ThemeProvider.jsx'

const Dropdown = ({ options, selectedOption, setSelectedOption, dropdownClassname }) => {
  const { isDark } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  const handleOptionClick = (option) => {
    setSelectedOption(option)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className='relative inline-block text-left'>
      <div>
        <button
          type='button'
          className={`inline-flex justify-between w-full rounded-md font-bold px-4 py-2 text-sm focus:outline-none transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}
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
        <div className={`z-50 origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg font-bold max-h-[20rem] overflow-auto transition-all duration-200 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'} ${dropdownClassname}`}>
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
                className={`block px-4 py-2 text-sm w-full text-left transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-black/20'}`}
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
