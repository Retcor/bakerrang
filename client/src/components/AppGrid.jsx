import { useNavigate } from 'react-router-dom'
import { useTheme } from '../providers/ThemeProvider.jsx'

const apps = [
  {
    label: 'Story Book',
    route: '/storybook',
    icon: (
      <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-8 h-8'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' />
      </svg>
    )
  },
  {
    label: 'Polyglot',
    route: '/polyglot',
    icon: (
      <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-8 h-8'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802' />
      </svg>
    )
  },
  {
    label: 'Polyglot Instant',
    route: '/polyglot/instant',
    icon: (
      <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-8 h-8'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z' />
      </svg>
    )
  },
  {
    label: 'Supermarket',
    route: '/supermarket',
    icon: (
      <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-8 h-8'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' />
      </svg>
    )
  },
  {
    label: 'Budget',
    route: '/budget',
    icon: (
      <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor' className='w-8 h-8'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
      </svg>
    )
  }
]

const AppGrid = ({ onNavigate }) => {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const handleClick = (route) => {
    navigate(route)
    if (onNavigate) onNavigate()
  }

  return (
    <div className='grid grid-cols-2 gap-2 p-3'>
      {apps.map((app, index) => {
        const isLastOdd = index === apps.length - 1 && apps.length % 2 !== 0
        return (
        <button
          key={app.route}
          onClick={() => handleClick(app.route)}
          className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 hover:scale-105 group ${isLastOdd ? 'col-span-2 justify-self-center' : ''} ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/8'}`}
        >
          <div className={`mb-2 transition-colors duration-200 ${isDark ? 'text-brand-dark group-hover:text-white' : 'text-brand-light group-hover:text-blue-700'}`}>
            {app.icon}
          </div>
          <span className={`text-xs font-medium text-center leading-tight ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
            {app.label}
          </span>
        </button>
        )
      })}
    </div>
  )
}

export default AppGrid
