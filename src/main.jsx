import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { loadAll } from './store.js'
import { startAutoSync } from './lib/sync.js'

createRoot(document.getElementById('root')).render(<App />)
loadAll().then(startAutoSync)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {})
