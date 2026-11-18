import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useKind, listKind, saveItems, getSettings } from '../store.js'
import { useApp, Icon, fmtDate, today } from './bits.jsx'
import { parseCommand, confirmText, matchNamed, spokenNumbers } from '../lib/voice.js'
import { mergeIntoList, quickItem } from '../lib/grocery.js'
import { aisleList } from '../lib/ingredients.js'
import { myWho, guessMeal } from '../lib/log.js'
import { foodFromDescription } from '../lib/gemini.js'
import { aiCfg, hasAi } from '../lib/importers.js'

export const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Say something out loud, so a confirmation lands without looking at the screen. */
export function say(text) {
  if (!canSpeak() || !text) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.98
    speechSynthesis.speak(u)
  } catch { /* nothing to be done */ }
}

/**
 * One spoken sentence, carried out. Returns what to say back. Kept apart from the listening
 * so the whole thing can be driven from a test or a deep link.
 */
export async function runCommand(said, app) {
  const lists = listKind('glist')
  const recipes = listKind('recipe')
  const cmd = parseCommand(said, { lists, recipes })
  if (!cmd) return { ok: false, text: `I did not understand "${said}".` }
  switch (cmd.kind) {
    case 'stop': return { ok: true, text: '' }
    case 'unclear': return { ok: false, text: cmd.why }
    case 'timer': app.startTimer(cmd.seconds, 'Timer'); return { ok: true, text: confirmText(cmd) }
    case 'tab': app.setTab(cmd.tab); return { ok: true, text: confirmText(cmd) }
    case 'open': app.push('recipe', { id: cmd.id }); return { ok: true, text: confirmText(cmd) }
    case 'cook': app.push('cook', { id: cmd.id }); return { ok: true, text: confirmText(cmd) }
    case 'add': {
      const settings = getSettings()
      const inc = { ...quickItem(spokenNumbers(cmd.item), 'grocery', aisleList(settings)), done: false, list: cmd.list || undefined }
      const existing = listKind('grocery').filter((e) => (e.list || '') === (cmd.list || ''))
      const out = mergeIntoList(existing, [inc])
      await saveItems(out)
      const listName = cmd.list ? lists.find((l) => l.id === cmd.list)?.name : 'groceries'
      return { ok: true, text: confirmText(cmd, { name: inc.name, listName }) }
    }
    case 'plan': {
      const meals = listKind('meal').filter((m) => m.date === today())
      const text = meals.length ? `Today: ${meals.map((m) => m.title).join(', ')}` : 'Nothing is planned for today'
      app.setTab('planner')
      return { ok: true, text }
    }
    case 'log': {
      if (!hasAi()) { app.push('logAdd', { date: today(), meal: guessMeal() }); return { ok: false, text: 'Working out calories needs the Gemini key, so I have opened the log for you.' } }
      const f = await foodFromDescription(aiCfg(), cmd.text)
      await saveItems([{ kind: 'logentry', who: myWho(), date: today(), meal: guessMeal(), qty: 1, unit: 'portion', name: f.name, per: f.per, notables: f.notables, portion: f.portion, via: 'ai' }])
      return { ok: true, text: `Logged ${f.name}, about ${Math.round(f.per.calories || 0)} calories` }
    }
    default: return { ok: false, text: '' }
  }
}

/**
 * The microphone, available from any screen. One tap, one sentence, one thing done — it is
 * not an always-on assistant, which would be both a battery and a privacy problem.
 */
export default function VoiceButton({ hidden }) {
  const app = useApp()
  useKind('recipe'); useKind('glist')
  const [state, setState] = useState('idle') // idle | listening | working | said
  const [text, setText] = useState('')
  const rec = useRef(null)
  const timer = useRef(null)

  const finish = useCallback((t, ok) => {
    setText(t); setState(t ? 'said' : 'idle')
    if (t) { say(t); if (!ok) app.toast(t) }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { setState('idle'); setText('') }, 4000)
  }, [app])

  const start = useCallback(() => {
    if (!SR) { app.toast('This browser cannot listen. Chrome on Android can.'); return }
    if (state === 'listening') { try { rec.current?.abort() } catch { /* not running */ } setState('idle'); return }
    const r = new SR()
    rec.current = r
    r.lang = navigator.language || 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = async (e) => {
      const said = e.results[0][0].transcript
      setText(said); setState('working')
      try { const out = await runCommand(said, app); finish(out.text || `I did not understand "${said}".`, out.ok) }
      catch (err) { finish(err.message || 'That did not work.', false) }
    }
    r.onerror = (e) => finish(e.error === 'not-allowed' ? 'The microphone is blocked. Allow it in the browser settings.' : e.error === 'no-speech' ? '' : 'I did not catch that.', false)
    r.onend = () => setState((s) => (s === 'listening' ? 'idle' : s))
    try { r.start(); setState('listening'); setText('') } catch { setState('idle') }
  }, [app, state, finish])

  // ?voice=1, or the home-screen shortcut, opens straight into listening
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (q.get('voice') === '1') { history.replaceState({}, '', location.pathname); setTimeout(start, 400) }
  }, [])

  if (hidden) return null
  const label = state === 'listening' ? 'Listening, tap to stop' : 'Speak a command'
  return (
    <>
      <button className={`mic ${state}`} onClick={start} aria-label={label} title={label}>
        <Icon name="mic" size={22} />
        {state === 'listening' && <span className="mic-ring" />}
      </button>
      {state !== 'idle' && text && <div className="mic-said" role="status">{text}</div>}
    </>
  )
}

/** A microphone that dictates into one field rather than running a command. */
export function Dictate({ onText, label = 'Dictate' }) {
  const [on, setOn] = useState(false)
  const rec = useRef(null)
  if (!SR) return null
  const start = () => {
    if (on) { try { rec.current?.abort() } catch { /* not running */ } setOn(false); return }
    const r = new SR()
    rec.current = r
    r.lang = navigator.language || 'en-US'
    r.interimResults = false
    r.onresult = (e) => onText(e.results[0][0].transcript)
    r.onerror = () => setOn(false)
    r.onend = () => setOn(false)
    try { r.start(); setOn(true) } catch { setOn(false) }
  }
  return <button type="button" className={`iconbtn dictate ${on ? 'on' : ''}`} aria-label={label} title={label} onClick={start}><Icon name="mic" size={18} /></button>
}
