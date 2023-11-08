import {BrowserRouter, Route, Routes} from "react-router-dom";

import {
  StoryBook,
  Navbar,
} from "./components";
import NoPage from "./components/NoPage.jsx";
import Polyglot from "./components/Polyglot.jsx";

export const SERVER_PREFIX = import.meta.env.REACT_APP_API_URL || `http://${window.location.hostname}:3001`

const App = () => {
  return (
    <BrowserRouter>
      <div className="relative z-0">
        <div className="bg-cover bg-no-repeat bg-center">
          <Navbar />
        </div>
        <div className="relative z-0">
          <Routes>
            <Route path='/' element={<StoryBook />} />
            <Route path='/polyglot' element={<Polyglot />} />
            <Route path='*' element={<NoPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
