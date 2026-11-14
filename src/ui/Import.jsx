import React, { useEffect, useRef, useState } from 'react'
import { saveItems, putPhoto, getItem, shrinkImage } from '../store.js'
import { useApp, Sheet, Icon, Field, Busy } from './bits.jsx'
import { readPaprikaFile } from '../lib/paprika.js'
import { importFromUrl, importFromText, importFromImages, hasAi } from '../lib/importers.js'

/** Import a Paprika export into the library. Returns counts. Exported for the Settings screen and tests. */
export async function importPaprika(file, onProgress) {
  let added = 0, updated = 0, batch = []
  const flush = async () => { if (batch.length) { await saveItems(batch); batch = [] } }
  const res = await readPaprikaFile(file, async ({ recipe, photos }) => {
    const old = getItem(recipe.id)
    old && !old.deleted ? updated++ : added++
    for (const p of photos) {
      let blob = new Blob([p.bytes], { type: 'image/jpeg' })
      if (blob.size > 500000) blob = await shrinkImage(blob, 1600)
      await putPhoto(recipe.id, p.idx, blob)
    }
    batch.push({ ...(old || {}), ...recipe, deleted: false, pv: (old?.pv || 0) + 1 })
    if (batch.length >= 25) await flush()
  }, onProgress)
  await flush()
  return { added, updated, failed: res.failed }
}

export default function ImportSheet({ mode: m0, url: u0 = '', text: t0 = '' }) {
  const app = useApp()
  const [mode, setMode] = useState(m0 || 'menu')
  const [url, setUrl] = useState(u0)
  const [text, setText] = useState(t0)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [prog, setProg] = useState(null)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null), camRef = useRef(null), pickRef = useRef(null)
  const run = async (label, fn) => {
    setBusy(label); setErr('')
    try { const { draft, via } = await fn(); app.replace('edit', { draft, via }) } catch (e) { setErr(e.message || String(e)); setBusy('') }
  }
  const fromLink = () => run('Reading the page', () => importFromUrl(url.trim(), mode === 'link' && t0 ? t0 : ''))
  useEffect(() => { if (m0 === 'link' && u0) fromLink(); else if (m0 === 'paste' && t0) run('Reading', () => importFromText(t0)) }, [])
  const paprika = async (file) => {
    if (!file) return
    setBusy('Importing'); setErr(''); setProg({ p: 0, n: 0 })
    try { setResult(await importPaprika(file, (p, n) => setProg({ p, n }))) } catch (e) { setErr(e.message || String(e)) }
    setBusy(''); setProg(null)
  }
  const title = { menu: 'Add a recipe', link: 'From a link', paste: 'From text', scan: 'Scan a recipe', paprika: 'Import from Paprika' }[mode]
  return (
    <Sheet title={title} onClose={app.back}>
      {err && <p className="banner err">{err}</p>}
      {busy && !prog && <Busy label={busy} />}
      {mode === 'menu' && !busy && (
        <div className="menu tiles">
          <button onClick={() => setMode('link')}><Icon name="link" /><span><b>From a link</b><small>Recipe sites, YouTube, Instagram, TikTok</small></span></button>
          <button onClick={() => setMode('paste')}><Icon name="paste" /><span><b>Paste text</b><small>Clipboard, captions, messages</small></span></button>
          <button onClick={() => setMode('scan')}><Icon name="camera" /><span><b>Scan</b><small>Cookbook page, recipe card, screenshot</small></span></button>
          <button onClick={() => app.replace('edit', {})}><Icon name="edit" /><span><b>Write it yourself</b><small>Start from a blank recipe</small></span></button>
          <button onClick={() => setMode('paprika')}><Icon name="file" /><span><b>Paprika file</b><small>Bring recipes over from Paprika</small></span></button>
        </div>
      )}
      {mode === 'link' && !busy && (
        <form onSubmit={(e) => { e.preventDefault(); fromLink() }}>
          <Field label="Link" hint={hasAi() ? 'Tip: in any app, tap Share and choose Cardamom.' : 'Recipe sites work without AI. Social posts and videos need the Gemini key in More.'}><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoFocus /></Field>
          <div className="rowline"><button type="button" className="btn" onClick={async () => { try { setUrl((await navigator.clipboard.readText()).trim()) } catch { setErr('Clipboard access was blocked. Long-press the box and paste.') } }}><Icon name="paste" size={18} />Paste</button><button className="btn primary grow" disabled={!/^https?:\/\//.test(url.trim())}>Get recipe</button></div>
        </form>
      )}
      {mode === 'paste' && !busy && (
        <form onSubmit={(e) => { e.preventDefault(); run('Reading', () => importFromText(text)) }}>
          <Field label="Recipe text" hint={hasAi() ? 'Any layout works.' : 'Without the Gemini key, use headings like Ingredients and Directions for best results.'}><textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a recipe, a caption or a link" /></Field>
          <div className="rowline"><button type="button" className="btn" onClick={async () => { try { setText(await navigator.clipboard.readText()) } catch { setErr('Clipboard access was blocked. Long-press the box and paste.') } }}><Icon name="paste" size={18} />From clipboard</button><button className="btn primary grow" disabled={text.trim().length < 10}>Make recipe</button></div>
        </form>
      )}
      {mode === 'scan' && !busy && (
        <>
          {!hasAi() && <p className="banner">Scanning needs your free Gemini key. Add it under More, then come back.</p>}
          <div className="menu tiles">
            <button disabled={!hasAi()} onClick={() => camRef.current.click()}><Icon name="camera" /><span><b>Take a photo</b><small>One page at a time</small></span></button>
            <button disabled={!hasAi()} onClick={() => pickRef.current.click()}><Icon name="file" /><span><b>Choose photos</b><small>Pick several if the recipe spans pages</small></span></button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files.length && run('Reading the photo', async () => importFromImages(await Promise.all([...e.target.files].map((f) => shrinkImage(f, 2000, 0.85)))))} />
          <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files.length && run('Reading the photos', async () => importFromImages(await Promise.all([...e.target.files].slice(0, 6).map((f) => shrinkImage(f, 2000, 0.85)))))} />
        </>
      )}
      {mode === 'paprika' && (
        result ? (
          <div className="done-card"><span className="bigtick"><Icon name="check" size={30} /></span><h3>{result.added + result.updated} recipes imported</h3><p>{result.added} new{result.updated ? `, ${result.updated} updated` : ''}{result.failed.length ? `, ${result.failed.length} could not be read` : ''}.</p>{result.failed.length > 0 && <p className="muted small">{result.failed.slice(0, 8).join(', ')}</p>}<button className="btn primary block" onClick={app.back}>Done</button></div>
        ) : prog ? (
          <div className="progress-card"><div className="progress"><i style={{ width: `${Math.round(prog.p * 100)}%` }} /></div><p>{prog.n} recipes so far. Keep this screen open.</p></div>
        ) : (
          <>
            <ol className="howto"><li>In Paprika, open <b>Settings</b>, then <b>Export</b>.</li><li>Choose <b>Paprika Recipe Format</b> and save the file.</li><li>Pick that file here. Photos, ratings and categories come along.</li></ol>
            <button className="btn primary block" onClick={() => fileRef.current.click()}><Icon name="file" size={18} />Choose export file</button>
            <input ref={fileRef} type="file" hidden onChange={(e) => paprika(e.target.files[0])} />
          </>
        )
      )}
    </Sheet>
  )
}
