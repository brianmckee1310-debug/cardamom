import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useItem } from '../store.js'
import { useApp, Icon, IconBtn } from './bits.jsx'
import { scaleLine, convertTemps, splitLines, splitSteps, findTimers, isHeader } from '../lib/ingredients.js'
import { StepText } from './RecipeView.jsx'

import { voiceCommand } from '../lib/voice.js'
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function CookMode({ id, factor = 1, system = 'original' }) {
  const app = useApp()
  const r = useItem(id)
  const steps = splitSteps(r?.directions).filter((s) => !isHeader(s)).map((s) => convertTemps(s, system))
  const ings = splitLines(r?.ingredients).map((l) => (isHeader(l) ? l : scaleLine(l, factor, system)))
  const [i, setI] = useState(0)
  const [showIngs, setShowIngs] = useState(false)
  const [voice, setVoice] = useState(false)
  const [heard, setHeard] = useState('')
  const [voiceErr, setVoiceErr] = useState('')
  const rec = useRef(null), speaking = useRef(false), live = useRef({})
  live.current = { i, steps, ings, voice }

  // The screen is kept awake app-wide now; this only has to stop talking on the way out.
  useEffect(() => () => { speechSynthesis?.cancel() }, [])

  const listen = useCallback(() => { if (!live.current.voice || speaking.current || !rec.current) return; try { rec.current.start() } catch { /* already running */ } }, [])
  const say = useCallback((text) => {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.97
    speaking.current = true
    try { rec.current?.abort() } catch { /* not running */ }
    u.onend = u.onerror = () => { speaking.current = false; setTimeout(listen, 250) }
    speechSynthesis.speak(u)
  }, [listen])
  const go = useCallback((n, speak = live.current.voice) => {
    const { steps } = live.current
    n = Math.max(0, Math.min(steps.length - 1, n))
    setI(n); setShowIngs(false)
    if (speak && steps[n]) say(`Step ${n + 1}. ${steps[n]}`)
  }, [say])

  const act = useCallback((cmd) => {
    const { i, steps, ings } = live.current
    if (cmd === 'next') i >= steps.length - 1 ? say('That was the last step. Enjoy.') : go(i + 1, true)
    else if (cmd === 'back') go(i - 1, true)
    else if (cmd === 'first') go(0, true)
    else if (cmd === 'repeat') go(i, true)
    else if (cmd === 'ingredients') { setShowIngs(true); say('Ingredients. ' + ings.join('. ')) }
    else if (cmd === 'stop') { speechSynthesis.cancel(); speaking.current = false }
    else if (cmd === 'timer') { const t = findTimers(steps[i] || '')[0]; if (t) { app.startTimer(t.seconds, t.label); say(`Timer set for ${t.label}`) } else say('This step has no time in it.') }
  }, [go, say, app])

  useEffect(() => {
    if (!voice) { try { rec.current?.abort() } catch { /* fine */ } rec.current = null; speechSynthesis?.cancel(); return }
    setVoiceErr('')
    if (SR) {
      const x = new SR()
      x.continuous = true; x.interimResults = false; x.lang = navigator.language || 'en-US'
      x.onresult = (e) => { const said = e.results[e.results.length - 1][0].transcript.trim(); setHeard(said); const cmd = voiceCommand(said); if (cmd) act(cmd) }
      x.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setVoiceErr('Microphone is blocked. Steps will still be read aloud.'); rec.current = null } }
      x.onend = () => setTimeout(listen, 300)
      rec.current = x
    } else setVoiceErr('This browser cannot listen. Steps will still be read aloud.')
    go(live.current.i, true)
    return () => { try { rec.current?.abort() } catch { /* fine */ } }
  }, [voice])

  if (!r) return null
  const timers = findTimers(steps[i] || '')
  return (
    <section className="page cook" role="dialog" aria-label="Cook mode">
      <header className="bar">
        <IconBtn icon="close" label="Leave cook mode" onClick={app.back} />
        <h2 className="bar-title">{r.name}</h2>
        <div className="bar-actions"><IconBtn icon="menu" label="Ingredients" active={showIngs} onClick={() => setShowIngs((v) => !v)} /><IconBtn icon="mic" label={voice ? 'Turn voice off' : 'Turn voice on'} active={voice} onClick={() => setVoice((v) => !v)} /></div>
      </header>
      <div className="cook-progress"><i style={{ width: `${steps.length ? ((i + 1) / steps.length) * 100 : 0}%` }} /></div>
      <div className="cook-body" key={showIngs ? 'ings' : i}>
        {showIngs ? <ul className="ings big">{ings.map((l, n) => isHeader(l) ? <li key={n} className="ing-head">{l}</li> : <li key={n}>{l}</li>)}</ul> : steps.length ? (
          <>
            <div className="cook-n">Step {i + 1} of {steps.length}</div>
            <p className="cook-step"><StepText text={steps[i]} onTimer={app.startTimer} /></p>
            {timers.length > 0 && <div className="chips">{timers.map((t, n) => <button key={n} className="chip on" onClick={() => app.startTimer(t.seconds, t.label)}><Icon name="timer" size={15} />Start {t.label}</button>)}</div>}
          </>
        ) : <p className="muted">This recipe has no directions.</p>}
      </div>
      {voice && <div className="voice-strip"><span className="pulse" /><span>{voiceErr || (heard ? `Heard “${heard}”` : 'Say “next”, “back”, “repeat”, “ingredients” or “start timer”')}</span></div>}
      <footer className="cook-nav">
        <button className="btn big" disabled={i === 0} onClick={() => go(i - 1)}><Icon name="back" />Back</button>
        <button className="btn big primary" disabled={i >= steps.length - 1} onClick={() => go(i + 1)}>Next<Icon name="chevron" /></button>
      </footer>
    </section>
  )
}
