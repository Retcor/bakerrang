import { Route, Routes } from 'react-router-dom'

import {
  StoryBook,
  MainContent,
  NoPage,
  Login,
  Polyglot,
  PolyglotInstant,
  Account,
  SuperMarket
} from './components'

export const SERVER_PREFIX = 'https://api.bakerrang.com'

const App = () => {
  return (
    <Routes>
      <Route element={<MainContent />}>
        <Route path='/' element={<StoryBook />} />
        <Route path='/polyglot' element={<Polyglot />} />
        <Route path='/polyglot/instant' element={<PolyglotInstant />} />
        <Route path='/supermarket' element={<SuperMarket />} />
        <Route path='/account' element={<Account />} />
        <Route path='*' element={<NoPage />} />
      </Route>
      <Route path='/login' element={<Login />} />
    </Routes>
  )
}

export default App
