import { Route, Routes } from 'react-router-dom'

import {
  StoryBook,
  MainContent
} from './components'
import NoPage from './components/NoPage.jsx'
import Polyglot from './components/Polyglot.jsx'
import Login from './components/Login.jsx'

export const SERVER_PREFIX = 'https://api.bakerrang.com'

const App = () => {
  return (
    <Routes>
      <Route element={<MainContent />}>
        <Route path='/' element={<StoryBook />} />
        <Route path='/polyglot' element={<Polyglot />} />
        <Route path='*' element={<NoPage />} />
      </Route>
      <Route path='/login' element={<Login />} />
    </Routes>
  )
}

export default App
