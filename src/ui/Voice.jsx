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

/** Speak, then carry on. The callback always runs, even where onend never fires. */
export function speakThen(text, done) {
  let ran = false
  const once = () => { if (ran) return; ran = true; done() }
  if (!canSpeak() || !text) return once()
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.02
    u.onend = once
    u.onerror = once
    speechSynthesis.speak(u)
    // Some Android voices never fire onend. Carry on anyway rather than hanging silently.
    setTimeout(once, 1200 + text.length * 70)
  } catch { once() }
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


// Ways of saying you have finished, which only mean that inside a hands-free session.
const ENOUGH = /^(done|finished|(that'?s|that is) (all|it|everything)|thank you|thanks|all set|no more)$/

/**
 * Hands-free adding: listen, add, say it back, listen again, until you say you are done or
 * stop talking. Built for a full pair of hands — nothing here needs a tap, and the one tap
 * there is, is large. The single-shot microphone above is still the right thing when you are
 * holding the phone; this is for when you are not.
 */
export function HandsFree({ onClose }) {
  const app = useApp()
  useKind('recipe'); useKind('glist')
  const [ui, setUi] = useState({ state: 'listening', heard: '', said: '' })
  const [added, setAdded] = useState([])

  useEffect(() => {
    if (!SR) { app.toast('This browser cannot listen. Chrome on Android can.'); onClose(); return }
    let closed = false
    let rec = null
    let idle = null
    const finish = (farewell) => {
      if (closed) return
      closed = true
      clearTimeout(idle)
      try { rec?.abort() } catch { /* not running */ }
      if (farewell) say(farewell)
      onClose()
    }

    const listen = () => {
      if (closed) return
      const r = new SR()
      rec = r
      r.lang = navigator.language || 'en-US'
      r.interimResults = false
      r.maxAlternatives = 1
      r.onresult = async (e) => {
        if (closed) return
        clearTimeout(idle)
        const text = e.results[0][0].transcript
        setUi({ state: 'working', heard: text, said: '' })
        const cmd = parseCommand(text, { lists: listKind('glist'), recipes: listKind('recipe') })
        if (cmd?.kind === 'stop' || ENOUGH.test(text.trim().toLowerCase().replace(/[.!?]+$/, ''))) return finish('Done')
        let msg, ok = false
        try { const out = await runCommand(text, app); msg = out.text || `I did not understand "${text}".`; ok = out.ok }
        catch (err) { msg = err.message || 'That did not work.' }
        if (closed) return
        if (ok) setAdded((a) => [...a, msg])
        setUi({ state: 'speaking', heard: text, said: msg })
        speakThen(msg, () => { if (!closed) listen() })
      }
      r.onerror = (ev) => {
        if (closed) return
        // Silence is how you finish when your hands are full: stop talking and it stops.
        if (ev.error === 'no-speech' || ev.error === 'aborted') return finish('')
        if (ev.error === 'not-allowed') { app.toast('The microphone is blocked. Allow it in the browser settings.'); return finish('') }
        setTimeout(() => { if (!closed) listen() }, 250)
      }
      try {
        r.start()
        setUi((u) => ({ ...u, state: 'listening' }))
        idle = setTimeout(() => finish(''), 12000)
      } catch { finish('') }
    }

    listen()
    return () => { closed = true; clearTimeout(idle); try { rec?.abort() } catch { /* not running */ } }
  }, [])

  const caption = ui.state === 'working' ? 'Adding' : ui.state === 'speaking' ? '' : 'Listening'
  return (
    <div className="hf" role="dialog" aria-modal="true" aria-label="Hands-free adding">
      <div className="hf-inner">
        <div className={`hf-orb ${ui.state}`} aria-hidden="true"><Icon name="mic" size={34} /><span className="hf-ring" /><span className="hf-ring two" /></div>
        <p className="hf-state" role="status">{ui.said || ui.heard || caption}</p>
        {caption && !ui.said && <p className="hf-hint">Say an item, or &ldquo;done&rdquo; when you have finished.</p>}
        {added.length > 0 && (
          <ul className="hf-added">{added.map((a, i) => <li key={i}>{a}</li>)}</ul>
        )}
        <button className="btn block hf-done" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
