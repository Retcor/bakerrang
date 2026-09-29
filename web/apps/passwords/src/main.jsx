import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import '@bakerrang/web-tokens/tokens.css'
import '@bakerrang/web-ui/styles.css'
import '@bakerrang/web-app-shell/styles.css'
import './styles/passwords.css'
import { AppProviders } from './providers.jsx'
import { App } from './App.jsx'
import { NotFound } from './NotFound.jsx'

registerSW({ immediate: true })
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><AppProviders><Routes><Route path='/' element={<App />} /><Route path='*' element={<NotFound />} /></Routes></AppProviders></BrowserRouter></React.StrictMode>)
