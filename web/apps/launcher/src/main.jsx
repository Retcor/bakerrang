import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@bakerrang/web-tokens/tokens.css'
import '@bakerrang/web-ui/styles.css'
import '@bakerrang/web-app-shell/styles.css'
import './styles.css'
import { AppProviders } from './providers.jsx'
import { Launcher } from './Launcher.jsx'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <Launcher />
    </AppProviders>
  </React.StrictMode>
)
