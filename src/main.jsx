import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Boom from './ui/Boom.jsx'
import './styles.css'
import { loadAll } from './store.js'

createRoot(document.getElementById('root')).render(<Boom where="app"><App /></Boom>)
// Sync (and with it the Supabase client) is loaded after the library is on screen.
loadAll().then(() => import('./lib/sync.js')).then((m) => m.startAutoSync()).catch(() => {})
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {})
