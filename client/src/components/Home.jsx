import { useTheme } from '../providers/ThemeProvider.jsx'
import AppGrid from './AppGrid.jsx'

const Home = () => {
  const { isDark } = useTheme()

  return (
    <div className='min-h-[calc(100vh-73px)] flex items-center justify-center px-4'>
      <div className={`rounded-2xl border ${isDark ? 'glass-card-dark border-white/10' : 'glass-card-light border-black/10'} shadow-xl`}>
        <AppGrid />
      </div>
    </div>
  )
}

export default Home
