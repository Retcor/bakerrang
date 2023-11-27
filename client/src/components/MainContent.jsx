import React, { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { AppProvider } from '../providers/AppProvider.jsx'

const MainContent = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { logout, auth } = useAuth()

  return (
    <AppProvider>
      <div className='relative z-0'>
        <div className='bg-cover bg-no-repeat bg-center'>
          <nav className='bg-gray-800 p-4 flex items-center justify-between'>
            <div className='flex items-center flex-shrink-0 mr-6'>
              <span className='text-2xl font-black tracking-tight text-[#D4ED31]'>BakerRang</span>
              <div className='hidden md:flex items-center space-x-4 ml-10'>
                <Link to='/' className='text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-black'>Story Book</Link>
                <Link to='/polyglot' className='text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-black'>Polyglot</Link>
              </div>
            </div>
            <div className='md:hidden'>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className='text-gray-300 hover:text-white focus:outline-none'
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

            <div className='hidden md:flex items-center space-x-4 relative'>
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
                  <div className='z-10 origin-top absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none' role='menu' aria-orientation='vertical' aria-labelledby='user-menu'>
                    <div className='py-1' role='none'>
                      <Link to='/account' onClick={() => setIsMenuOpen(false)} className='block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 w-full text-left'>Account</Link>
                      <button
                        onClick={() => logout()}
                        className='block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 w-full text-left'
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
              <div className='md:hidden'>
                <div className='px-2 pt-2 pb-3 space-y-1 sm:px-3'>
                  <Link to='/' className='text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium'>Story Book</Link>
                  <Link to='/polyglot' className='text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium'>Polyglot</Link>
                </div>
                <div className='pt-4 pb-3 border-t border-gray-700'>
                  <div className='flex flex-col px-5'>
                    <button
                      className='text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium'
                      onClick={() => console.log('Account clicked')}
                    >
                      Account
                    </button>
                    <button
                      className='text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium'
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
        <div className='relative z-0'>
          <Outlet />
        </div>
      </div>
    </AppProvider>
  )
}

export default MainContent
