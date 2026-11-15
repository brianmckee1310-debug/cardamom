import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppCtx, Icon, IconBtn, useWide } from './ui/bits.jsx'
import { useStore, clearError, restoreItem, useSettings } from './store.js'
import Recipes from './ui/Recipes.jsx'
import RecipeView from './ui/RecipeView.jsx'
import RecipeEdit from './ui/RecipeEdit.jsx'
import CookMode from './ui/CookMode.jsx'
import Grocery from './ui/Grocery.jsx'
import Pantry from './ui/Pantry.jsx'
import Planner from './ui/Planner.jsx'
import { Menus, MenuView } from './ui/Menus.jsx'
import FoodLog from './ui/FoodLog.jsx'
import LogAdd, { LogEntry, LogTargets } from './ui/LogSheets.jsx'
import { RecipePicker, AddToGroceries, AddToPlan, ItemEdit, AddToMenu } from './ui/Sheets.jsx'
import { firstUrl } from './lib/importers.js'

// Split out of the first load: Import pulls in the zip reader, More pulls in the Supabase
// client, Barcode pulls in the camera decoder. None of them is needed to show the library.
const ImportSheet = lazy(() => import('./ui/Import.jsx'))
const Barcode = lazy(() => import('./ui/Barcode.jsx'))
const More = lazy(() => import('./ui/More.jsx'))
const named = (key) => lazy(() => import('./ui/More.jsx').then((m) => ({ default: m[key] })))
const Household = named('Household'), Roadmap = named('Roadmap'), Categories = named('Categories')

const TABS = [['recipes', 'Recipes', 'book'], ['log', 'Log', 'bowl'], ['groceries', 'Groceries', 'cart'], ['planner', 'Planner', 'calendar'], ['pantry', 'Pantry', 'jar'], ['more', 'More', 'more']]
const VIEWS = { recipe: RecipeView, edit: RecipeEdit, cook: CookMode, import: ImportSheet, menus: Menus, menu: MenuView, household: Household, roadmap: Roadmap, categories: Categories, barcode: Barcode, pick: RecipePicker, addToGroceries: AddToGroceries, addToPlan: AddToPlan, itemEdit: ItemEdit, addToMenu: AddToMenu, logAdd: LogAdd, logEntry: LogEntry, logTargets: LogTargets }
const TAB_COMPONENTS = { recipes: Recipes, log: FoodLog, groceries: Grocery, planner: Planner, pantry: Pantry, more: More }
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0') }

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach((t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3) })
    navigator.vibrate?.([300, 150, 300, 150, 600])
  } catch { /* no audio */ }
}

export default function App() {
  const store = useStore()
  const settings = useSettings()
  const wide = useWide()
  const [tab, setTab] = useState('recipes')
  const [stack, setStack] = useState([])
  const [toasts, setToasts] = useState([])
  const [timers, setTimers] = useState([])
  const [, setTick] = useState(0)
  const seq = useRef(1)

  const push = useCallback((type, props = {}) => { history.pushState({ d: Date.now() }, ''); setStack((s) => [...s, { type, props, key: seq.current++ }]) }, [])
  const waiting = useRef([])
  const back = useCallback(() => new Promise((res) => { waiting.current.push(res); history.back() }), [])
  const replace = useCallback((type, props = {}) => setStack((s) => [...s.slice(0, -1), { type, props, key: seq.current++ }]), [])
  useEffect(() => { const f = () => { setStack((s) => s.slice(0, -1)); waiting.current.splice(0).forEach((r) => setTimeout(r, 0)) }; addEventListener('popstate', f); return () => removeEventListener('popstate', f) }, [])

  const toast = useCallback((text, opts = {}) => {
    const id = seq.current++
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.undo ? 7000 : 3200)
  }, [])
  const removed = useCallback((label, ids) => toast(label, { undo: async () => { for (const id of [].concat(ids)) await restoreItem(id) } }), [toast])

  const startTimer = useCallback((seconds, label) => {
    setTimers((t) => [...t, { id: seq.current++, label, end: Date.now() + seconds * 1000, total: seconds }])
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    toast(`Timer started: ${label}`)
  }, [toast])
  useEffect(() => {
    if (!timers.length) return
    const i = setInterval(() => {
      setTick((x) => x + 1)
      setTimers((ts) => ts.map((t) => {
        if (!t.done && Date.now() >= t.end) { beep(); try { if (Notification.permission === 'granted') navigator.serviceWorker?.ready.then((r) => r.showNotification('Timer done', { body: t.label, tag: 't' + t.id })) } catch { /* ignore */ } return { ...t, done: true } }
        return t
      }))
    }, 500)
    return () => clearInterval(i)
  }, [timers.length])

  // links / text shared into the app from other apps (Android share sheet), or ?import=
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const shared = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join('\n')
    if (shared) { history.replaceState({}, '', location.pathname); const url = firstUrl(shared); push('import', url ? { mode: 'link', url, text: shared } : { mode: 'paste', text: shared }) }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = settings.theme || 'auto' }, [settings.theme])

  const ctx = useMemo(() => ({ push, back, replace, toast, removed, startTimer, setTab, wide }), [push, back, replace, toast, removed, startTimer, wide])
  // The pane is held by identity so pushing an overlay, firing a toast or ticking a timer does
  // not re-render a library of several hundred rows underneath it.
  const pane = useMemo(() => { const T = TAB_COMPONENTS[tab]; return <T /> }, [tab])
  if (!store.ready) return <div className="boot"><span className="spinner" /></div>
  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app ${wide ? 'wide' : ''}`}>
        <nav className="tabs" aria-label="Sections">
          <div className="brand"><img src="./icon.svg" alt="" width="30" height="30" /><span>Cardamom</span></div>
          {TABS.map(([id, label, icon]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); if (stack.length) { history.go(-stack.length); setStack([]) } }} aria-current={tab === id ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></button>
          ))}
        </nav>
        <main className="tabpane" key={tab}><Suspense fallback={<div className="boot"><span className="spinner" /></div>}>{pane}</Suspense></main>
        {timers.length > 0 && (
          <div className="timers">
            {timers.map((t) => (
              <div key={t.id} className={`timer ${t.done ? 'done' : ''}`}>
                <Icon name="timer" size={18} /><b>{t.done ? 'Done' : fmt((t.end - Date.now()) / 1000)}</b><span>{t.label}</span>
                <IconBtn icon="close" label="Dismiss timer" onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))} />
              </div>
            ))}
          </div>
        )}
        <Suspense fallback={null}>{stack.map((s) => { const V = VIEWS[s.type]; return V ? <V key={s.key} {...s.props} /> : null })}</Suspense>
        <div className="toasts" aria-live="polite">
          {store.error && <div className="toast err"><span>{store.error}</span><button onClick={clearError}>OK</button></div>}
          {toasts.map((t) => <div className="toast" key={t.id}><span>{t.text}</span>{t.undo && <button onClick={() => { t.undo(); setToasts((x) => x.filter((y) => y.id !== t.id)) }}>Undo</button>}</div>)}
        </div>
      </div>
    </AppCtx.Provider>
  )
}
