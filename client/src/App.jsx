import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './providers/ThemeProvider.jsx'

import {
  Home,
  StoryBook,
  MainContent,
  NoPage,
  Login,
  Polyglot,
  PolyglotInstant,
  Account,
  SuperMarket,
  Budget,
  SignLanguage
} from './components'

export const SERVER_PREFIX = 'https://api.bakerrang.com'

const App = () => {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<MainContent />}>
          <Route path='/' element={<Home />} />
          <Route path='/storybook' element={<StoryBook />} />
          <Route path='/polyglot' element={<Polyglot />} />
          <Route path='/polyglot/instant' element={<PolyglotInstant />} />
          <Route path='/supermarket' element={<SuperMarket />} />
          <Route path='/account' element={<Account />} />
          <Route path='/budget' element={<Budget />} />
          <Route path='/sign-language' element={<SignLanguage />} />
          <Route path='*' element={<NoPage />} />
        </Route>
        <Route path='/login' element={<Login />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App
