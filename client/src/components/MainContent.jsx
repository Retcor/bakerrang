import React, { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { AppProvider } from '../providers/AppProvider.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'

const MainContent = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { logout, auth } = useAuth()
  const { toggleTheme, isDark } = useTheme()

  return (
    <AppProvider>
      <div className={`relative z-0 theme-bg ${isDark ? 'dark-theme-bg' : 'light-theme-bg'}`}>
        <div className='bg-cover bg-no-repeat bg-center'>
          <nav className={`p-4 flex items-center justify-between relative z-40 ${isDark ? 'glass-nav-dark' : 'glass-nav-light'}`}>
            <div className='flex items-center flex-shrink-0 mr-6'>
              <span className='text-2xl font-black tracking-tight text-[#D4ED31]'>BakerRang</span>
              <div className='hidden md:flex items-center space-x-4 ml-10'>
                <Link to='/' className={`px-3 py-2 rounded-md text-sm font-black transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Story Book</Link>
                <Link to='/polyglot' className={`px-3 py-2 rounded-md text-sm font-black transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Polyglot</Link>
                <Link to='/polyglot/instant' className={`px-3 py-2 rounded-md text-sm font-black transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Polyglot Instant</Link>
                <Link to='/supermarket' className={`px-3 py-2 rounded-md text-sm font-black transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Supermarket</Link>
              </div>
            </div>
            <div className='md:hidden'>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`focus:outline-none transition-all duration-200 ${isDark ? 'text-theme-dark hover:text-white' : 'text-theme-light hover:text-white'}`}
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
            </div>

            <div className='hidden md:flex items-center space-x-4 relative z-50'>
              <div className='relative'>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className='bg-gray-700 text-[#D4ED31] hover:bg-gray-600 rounded-full text-sm font-medium flex items-center'
                >
                  {auth && auth.user && auth.user.photo
                    ? (
                      <img className='rounded-full object-cover w-8 h-8' alt='' src={auth.user.photo} />
                      )
                    : (
                      <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='p-1 w-8 h-8'>
                        <path strokeLinecap='round' strokeLinejoin='round' d='M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z' />
                      </svg>
                      )}
                </button>
                {isMenuOpen && (
                  <div className={`z-50 origin-top absolute right-0 mt-2 w-48 rounded-md transition-all duration-200 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'}`} role='menu' aria-orientation='vertical' aria-labelledby='user-menu'>
                    <div className='py-1' role='none'>
                      <Link to='/account' onClick={() => setIsMenuOpen(false)} className={`block px-4 py-2 text-sm w-full text-left transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Account</Link>
                      <button
                        onClick={() => {
                          toggleTheme()
                          setIsMenuOpen(false)
                        }}
                        className={`flex items-center justify-between px-4 py-2 text-sm w-full text-left transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}
                        role='menuitem'
                      >
                        <span>
                          {isDark
                            ? 'Light Mode'
                            : 'Dark Mode'}
                        </span>
                        <div className='flex items-center ml-2'>
                          {isDark
                            ? (
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' />
                              </svg>
                              )
                            : (
                              <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-4 h-4'>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z' />
                              </svg>
                              )}
                        </div>
                      </button>
                      <button
                        onClick={() => logout()}
                        className={`block px-4 py-2 text-sm w-full text-left transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}
                        role='menuitem'
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Dropdown menu for small screens */}
            {isMenuOpen && (
              <div className={`md:hidden absolute top-full left-0 right-0 mt-1 mx-4 rounded-lg transition-all duration-200 z-50 ${isDark ? 'glass-dropdown-dark' : 'glass-dropdown-light'}`}>
                <div className='px-2 pt-2 pb-3 space-y-1 sm:px-3'>
                  <Link to='/' onClick={() => setIsMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Story Book</Link>
                  <Link to='/polyglot' onClick={() => setIsMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Polyglot</Link>
                  <Link to='/polyglot/instant' onClick={() => setIsMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Polyglot Instant</Link>
                  <Link to='/supermarket' onClick={() => setIsMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Supermarket</Link>
                </div>
                <div className={`pt-4 pb-3 ${isDark ? 'border-t border-white/20' : 'border-t border-white/30'}`}>
                  <div className='flex flex-col px-5'>
                    <Link to='/account' onClick={() => setIsMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}>Account</Link>
                    <button
                      onClick={() => {
                        toggleTheme()
                        setIsMenuOpen(false)
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}
                    >
                      <span>
                        {isDark
                          ? 'Light Mode'
                          : 'Dark Mode'}
                      </span>
                      <div className='flex items-center ml-2'>
                        {isDark
                          ? (
                            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-5 h-5'>
                              <path strokeLinecap='round' strokeLinejoin='round' d='M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z' />
                            </svg>
                            )
                          : (
                            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-5 h-5'>
                              <path strokeLinecap='round' strokeLinejoin='round' d='M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z' />
                            </svg>
                            )}
                      </div>
                    </button>
                    <button
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ${isDark ? 'text-theme-dark hover:bg-white/20' : 'text-theme-light hover:bg-white/30'}`}
                      onClick={() => logout()}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
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
