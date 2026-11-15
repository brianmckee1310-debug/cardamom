import React, { useEffect, useRef, useState } from 'react'
import { saveItem } from '../store.js'
import { useApp, Sheet, Icon, Field, Busy } from './bits.jsx'
import { lookupBarcode } from '../lib/importers.js'
import { guessAisle } from '../lib/ingredients.js'

import { hasNut } from '../lib/nutrition.js'
import { matchNotables } from '../lib/notables.js'
import { guessMeal } from '../lib/log.js'
import { today } from './bits.jsx'

export default function Barcode({ target: t0 = 'grocery', date, meal }) {
  const app = useApp()
  const video = useRef(null)
  const [target, setTarget] = useState(t0)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [prod, setProd] = useState(null)
  const [state, setState] = useState('scan') // scan | looking | found | manual
  const [note, setNote] = useState('')
  const [camera, setCamera] = useState('starting')
  const last = useRef('')
  const lookup = async (c) => {
    setCode(c); setState('looking'); setNote('')
    try {
      const p = await lookupBarcode(c)
      setProd(p)
      if (p) {
        setName(p.name)
        if (target === 'log' && !hasNut(p.per100)) setNote('Found it, but the label nutrition is missing from the database. You can still log it and type the numbers.')
      } else { setName(''); setNote('Not in the product database. Type a name.') }
    } catch { setProd(null); setName(''); setNote('Could not look that up (offline?). Type a name.') }
    setState('found')
  }
  useEffect(() => {
    let stream, on = true, timer
    const start = async () => {
      if (!('BarcodeDetector' in window)) { setCamera('unsupported'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!on) return stream.getTracks().forEach((t) => t.stop())
        video.current.srcObject = stream; await video.current.play(); setCamera('on')
        const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        const loop = async () => {
          if (!on) return
          try { const found = await det.detect(video.current); const c = found[0]?.rawValue; if (c && c !== last.current && stateRef.current === 'scan') { last.current = c; navigator.vibrate?.(60); lookup(c) } } catch { /* frame not ready */ }
          timer = setTimeout(loop, 250)
        }
        loop()
      } catch { setCamera('blocked') }
    }
    start()
    return () => { on = false; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [])
  const stateRef = useRef(state); stateRef.current = state
  const add = async () => {
    if (!name.trim()) return
    if (target === 'log') {
      // Prefer the label's own per-serving figures; fall back to per 100 g, which is always there.
      const perServing = prod?.perServing && hasNut(prod.perServing)
      const draft = {
        name: name.trim(), unit: perServing ? 'serving' : '100 g',
        per: perServing ? prod.perServing : (prod?.per100 || {}),
        portion: perServing ? prod.serving : prod ? 'per 100 g' : '',
        notables: matchNotables(`${name}\n${prod?.ingredients || ''}`),
        barcode: code, via: 'product',
      }
      app.replace('logAdd', { date: date || today(), meal: meal || guessMeal(), draft })
      return
    }
    await saveItem(target === 'pantry' ? { kind: 'pantry', name: name.trim(), qty: '', aisle: guessAisle(name), inStock: true, barcode: code } : { kind: 'grocery', name: name.trim(), qty: '', aisle: guessAisle(name), done: false, barcode: code })
    app.toast(`${name.trim()} added to ${target === 'pantry' ? 'pantry' : 'groceries'}`)
    setName(''); setCode(''); setState('scan'); setTimeout(() => { last.current = '' }, 2500)
  }
  return (
    <Sheet title="Scan a barcode" onClose={app.back} tall>
      <div className="seg">{[['grocery', 'Groceries'], ['pantry', 'Pantry'], ['log', 'Food log']].map(([k, l]) => <button key={k} className={target === k ? 'on' : ''} onClick={() => setTarget(k)}>{l}</button>)}</div>
      <div className={`scanner ${camera}`}><video ref={video} playsInline muted /><span className="scan-line" />{camera !== 'on' && <p>{camera === 'starting' ? 'Starting camera' : camera === 'blocked' ? 'Camera is blocked. Allow it in the browser, or type the number below.' : 'This browser cannot read barcodes with the camera. Type the number below.'}</p>}</div>
      {state === 'looking' && <Busy label={`Looking up ${code}`} />}
      {state === 'found' ? (
        <form onSubmit={(e) => { e.preventDefault(); add() }}>
          {note && <p className="banner">{note}</p>}
          <Field label={`Item (${code})`}><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          {target === 'log' && prod && hasNut(prod.perServing || prod.per100) && <p className="muted small nudge">Label nutrition found{prod.serving ? ` — per serving (${prod.serving})` : ' — per 100 g'}. You set the amount on the next screen.</p>}
          <div className="rowline"><button type="button" className="btn" onClick={() => { setState('scan'); last.current = '' }}>Skip</button><button className="btn primary grow" disabled={!name.trim()}>{target === 'log' ? 'Next' : 'Add'}</button></div>
        </form>
      ) : state === 'scan' && (
        <form className="rowline" onSubmit={(e) => { e.preventDefault(); /^\d{6,14}$/.test(code.trim()) && lookup(code.trim()) }}><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type the barcode number" inputMode="numeric" aria-label="Barcode number" /><button className="btn" disabled={!/^\d{6,14}$/.test(code.trim())}>Look up</button></form>
      )}
    </Sheet>
  )
}
