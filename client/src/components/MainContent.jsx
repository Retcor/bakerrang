import React, { useState, useEffect, useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { AppProvider } from '../providers/AppProvider.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'

const MainContent = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { logout, auth } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const dropdownRef = useRef()
  const mobileMenuRef = useRef()

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside both desktop dropdown and mobile menu
      const isOutsideDesktopDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target)
      const isOutsideMobileMenu = mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)

      if ((isOutsideDesktopDropdown || !dropdownRef.current) && (isOutsideMobileMenu || !mobileMenuRef.current)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <AppProvider>
      <div className={`relative z-0 theme-bg ${isDark ? 'dark-theme-bg' : 'light-theme-bg'}`}>
        <div className='bg-cover bg-no-repeat bg-center'>
          <nav className={`px-6 py-4 flex items-center justify-between relative z-40 ${isDark ? 'glass-nav-dark' : 'glass-nav-light'} border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
            {/* Logo and Navigation Links */}
            <div className='flex items-center space-x-12'>
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-brand-dark' : 'text-brand-light'}`}>BakerRang</span>
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-md ${isDark ? 'bg-accent-dark text-gray-900' : 'bg-accent-light text-white'}`}>AI</span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className='hidden md:flex items-center space-x-2'>
                <Link to='/' className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:text-white' : 'text-theme-light hover:text-black'} hover:scale-105 group`}>
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 ${isDark ? 'bg-gradient-to-r from-white/10 to-white/20' : 'bg-gradient-to-r from-black/10 to-black/20'}`}></div>
                  <span className="relative">Story Book</span>
                </Link>
                <Link to='/polyglot' className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:text-white' : 'text-theme-light hover:text-black'} hover:scale-105 group`}>
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 ${isDark ? 'bg-gradient-to-r from-white/10 to-white/20' : 'bg-gradient-to-r from-black/10 to-black/20'}`}></div>
                  <span className="relative">Polyglot</span>
                </Link>
                <Link to='/polyglot/instant' className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:text-white' : 'text-theme-light hover:text-black'} hover:scale-105 group`}>
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 ${isDark ? 'bg-gradient-to-r from-white/10 to-white/20' : 'bg-gradient-to-r from-black/10 to-black/20'}`}></div>
                  <span className="relative">Polyglot Instant</span>
                </Link>
                <Link to='/supermarket' className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:text-white' : 'text-theme-light hover:text-black'} hover:scale-105 group`}>
                  <div className={`absolute inset-0 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 ${isDark ? 'bg-gradient-to-r from-white/10 to-white/20' : 'bg-gradient-to-r from-black/10 to-black/20'}`}></div>
                  <span className="relative">Supermarket</span>
                </Link>
              </div>
            </div>
            <div className='md:hidden' ref={mobileMenuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-2 rounded-lg focus:outline-none transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/10 hover:text-white' : 'text-theme-light hover:bg-black/10 hover:text-black'}`}
              >
                <svg
                  className='h-6 w-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 6h16M4 12h16M4 18h16'
                  />
                </svg>
              </button>

              {/* Dropdown menu for small screens */}
              {isMenuOpen && (
                <div className={`absolute top-full left-0 right-0 mt-2 mx-4 rounded-xl transition-all duration-200 z-50 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'} border ${isDark ? 'border-white/10' : 'border-black/10'} shadow-xl`}>
                  <div className='p-4 space-y-3'>
                    <Link to='/' onClick={() => setIsMenuOpen(false)} className={`block px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:bg-white/10 hover:text-white' : 'text-theme-light hover:bg-black/10 hover:text-black'}`}>
                      Story Book
                    </Link>
                    <Link to='/polyglot' onClick={() => setIsMenuOpen(false)} className={`block px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:bg-white/10 hover:text-white' : 'text-theme-light hover:bg-black/10 hover:text-black'}`}>
                      Polyglot
                    </Link>
                    <Link to='/polyglot/instant' onClick={() => setIsMenuOpen(false)} className={`block px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:bg-white/10 hover:text-white' : 'text-theme-light hover:bg-black/10 hover:text-black'}`}>
                      Polyglot Instant
                    </Link>
                    <Link to='/supermarket' onClick={() => setIsMenuOpen(false)} className={`block px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${isDark ? 'text-theme-dark hover:bg-white/10 hover:text-white' : 'text-theme-light hover:bg-black/10 hover:text-black'}`}>
                      Supermarket
                    </Link>
                  </div>
                  <div className={`pt-3 pb-4 ${isDark ? 'border-t border-white/10' : 'border-t border-black/10'} mx-4`}>
                    <div className='space-y-2 mt-3'>
                      <Link
                        to='/account'
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/10' : 'text-theme-light hover:bg-black/10'}`}
                      >
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z' />
                        </svg>
                        Account
                      </Link>
                      <button
                        onClick={() => {
                          toggleTheme()
                          setIsMenuOpen(false)
                        }}
                        className={`flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/10' : 'text-theme-light hover:bg-black/10'}`}
                      >
                        <div className='flex items-center'>
                          {isDark
                            ? (
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' />
                              </svg>
                              )
                            : (
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z' />
                              </svg>
                              )}
                          <span>
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                          </span>
                        </div>
                      </button>
                      <button
                        className={`flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-red-400 hover:bg-red-500/10`}
                        onClick={() => logout()}
                      >
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75' />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className='hidden md:flex items-center space-x-4 relative z-50'>
              <div className='relative' ref={dropdownRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-1 rounded-xl text-sm font-medium flex items-center transition-all duration-200 ${isDark ? 'glass-dark hover:bg-white/20' : 'glass-light hover:bg-black/20'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}
                >
                  {auth && auth.user && auth.user.photo
                    ? (
                      <img className='rounded-lg object-cover w-8 h-8' alt='' src={auth.user.photo} />
                      )
                    : (
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className={`w-5 h-5 ${isDark ? 'text-gray-900' : 'text-white'}`}>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z' />
                        </svg>
                      </div>
                      )}
                </button>
                {isMenuOpen && (
                  <div className={`z-50 origin-top absolute right-0 mt-3 w-52 rounded-xl transition-all duration-200 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border shadow-xl`} role='menu' aria-orientation='vertical' aria-labelledby='user-menu'>
                    <div className='px-2 py-2' role='none'>
                      <Link to='/account' onClick={() => setIsMenuOpen(false)} className={`flex items-center px-3 py-3 text-sm w-full text-left transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-gray-800' : 'text-theme-light hover:bg-gray-100'} rounded-lg`}>
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z' />
                        </svg>
                        Account
                      </Link>
                      <button
                        onClick={() => {
                          toggleTheme()
                          setIsMenuOpen(false)
                        }}
                        className={`flex items-center justify-between px-3 py-3 text-sm w-full text-left transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-gray-800' : 'text-theme-light hover:bg-gray-100'} rounded-lg`}
                        role='menuitem'
                      >
                        <div className='flex items-center'>
                          {isDark
                            ? (
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' />
                              </svg>
                              )
                            : (
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z' />
                              </svg>
                              )}
                          <span>
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                          </span>
                        </div>
                      </button>
                      <div className={`my-2 mx-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}></div>
                      <button
                        onClick={() => logout()}
                        className={`flex items-center px-3 py-3 text-sm w-full text-left transition-all duration-200 text-red-400 hover:bg-red-500/10 rounded-lg`}
                        role='menuitem'
                      >
                        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4 mr-3'>
                          <path strokeLinecap='round' strokeLinejoin='round' d='M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75' />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
        <div className='relative z-10'>
          <Outlet />
        </div>
      </div>
    </AppProvider>
  )
}

export default MainContent
