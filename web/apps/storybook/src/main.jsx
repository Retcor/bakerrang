import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@bakerrang/web-tokens/tokens.css'
import '@bakerrang/web-ui/styles.css'
import '@bakerrang/web-app-shell/styles.css'
import './styles/storybook.css'
import { AppProviders } from './providers.jsx'
import { App } from './App.jsx'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppProviders><App /></AppProviders></React.StrictMode>
)
