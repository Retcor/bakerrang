import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import '@bakerrang/web-tokens/tokens.css'
import '@bakerrang/web-ui/styles.css'
import '@bakerrang/web-app-shell/styles.css'
import './styles/account.css'
import { AppProviders } from './providers.jsx'
import { App } from './App.jsx'

registerSW({ immediate: true })
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>
)
