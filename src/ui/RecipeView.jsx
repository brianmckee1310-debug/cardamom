import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useItem, saveItem, removeItem, usePhoto, photosOf, useSettings, setSetting } from '../store.js'
import { useApp, Page, Icon, IconBtn, Stars, Sheet, Busy, NumStepper, today } from './bits.jsx'
import { notablesForRecipe, mergeNotables } from '../lib/notables.js'
import { guessMeal } from '../lib/log.js'
import { NotableCard } from './FoodLog.jsx'
import { scaleLine, convertTemps, splitLines, splitSteps, findTimers, isHeader, parseServings, formatNumber } from '../lib/ingredients.js'
import { analyseNutrition } from '../lib/gemini.js'
import { aiCfg, hasAi } from '../lib/importers.js'

const crossed = new Map() // recipe id -> Set of ingredient indexes, kept while the app is open
const stepAt = new Map()
export const SCALES = [0.5, 1, 1.5, 2, 3, 4]

export function download(name, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export function recipeAsText(r) {
  return [r.name, r.source_url || r.source, [r.servings && `Servings: ${r.servings}`, r.prep_time && `Prep: ${r.prep_time}`, r.cook_time && `Cook: ${r.cook_time}`].filter(Boolean).join(' | '), r.description, 'INGREDIENTS\n' + r.ingredients, 'DIRECTIONS\n' + r.directions, r.notes && 'NOTES\n' + r.notes].filter(Boolean).join('\n\n')
}

export function StepText({ text, onTimer }) {
  const parts = useMemo(() => { const ts = findTimers(text); const out = []; let at = 0; ts.forEach((t) => { out.push(text.slice(at, t.start)); out.push(t); at = t.end }); out.push(text.slice(at)); return out }, [text])
  return <>{parts.map((p, i) => typeof p === 'string' ? p : <button key={i} className="time-link" onClick={(e) => { e.stopPropagation(); onTimer(p.seconds, p.label) }}>{p.label}</button>)}</>
}

function Gallery({ recipe, onClose }) {
  const [urls, setUrls] = useState([])
  useEffect(() => { let made = []; photosOf(recipe.id).then((ps) => { made = ps.map((p) => URL.createObjectURL(p.blob)); setUrls(made) }); return () => made.forEach((u) => URL.revokeObjectURL(u)) }, [recipe.id])
  return <div className="gallery" onClick={onClose}><IconBtn icon="close" label="Close photos" onClick={onClose} /><div className="gallery-strip">{urls.map((u) => <img key={u} src={u} alt="" />)}</div></div>
}

export default function RecipeView({ id }) {
  const app = useApp()
  const r = useItem(id)
  const settings = useSettings()
  const [bump, setBump] = useState(0)
  useEffect(() => { const f = (e) => e.detail === id && setBump((b) => b + 1); addEventListener('cardamom-photo', f); return () => removeEventListener('cardamom-photo', f) }, [id])
  const hero = usePhoto(id, 0, (r?.pv || 0) + bump)
  const [factor, setFactor] = useState(1)
  const system = settings.units || 'original'
  const [menu, setMenu] = useState(false)
  const [scaling, setScaling] = useState(false)
  const [gallery, setGallery] = useState(false)
  const [busy, setBusy] = useState('')
  const [, force] = useState(0)
  if (!crossed.has(id)) crossed.set(id, new Set())
  const done = crossed.get(id)
  const step = stepAt.get(id) ?? -1
  // Parsing the ingredients and directions, and matching the notables table, used to run on
  // every render -- including every tap on an ingredient. Memoised, so a tap is just a repaint.
  const ings = useMemo(() => splitLines(r?.ingredients), [r?.ingredients])
  const steps = useMemo(() => splitSteps(r?.directions), [r?.directions])
  const base = useMemo(() => parseServings(r?.servings), [r?.servings])
  const whatsIn = useMemo(() => mergeNotables(notablesForRecipe(r || {}, 8), r?.notables), [r?.id, r?.ingredients, r?.name, r?.notables])
  const scaledIngs = useMemo(() => ings.map((l) => (isHeader(l) ? null : scaleLine(l, factor, system))), [ings, factor, system])
  const scaledSteps = useMemo(() => steps.map((x) => convertTemps(x, system)), [steps, system])
  const stepNums = useMemo(() => { let n = 0; return steps.map((x) => (isHeader(x) ? null : ++n)) }, [steps])
  if (!r) return <Page title="Recipe" onBack={app.back}><p className="pad muted">This recipe was deleted.</p></Page>
  const servingsText = base && factor !== 1 ? r.servings.replace(/\d+(?:\.\d+)?/, formatNumber(base * factor, { fractions: false })) : r.servings
  const set = (patch) => saveItem({ ...r, ...patch })

  const nutrition = async () => {
    setMenu(false); setBusy('Analysing nutrition')
    try {
      const { values, text, notables } = await analyseNutrition(aiCfg(), r)
      await set({ nut: values, nutritional_info: text, notables: mergeNotables(notablesForRecipe(r), notables) })
      app.toast('Nutrition added')
    } catch (e) { app.toast(e.message) }
    setBusy('')
  }
  const share = async () => {
    setMenu(false)
    const text = recipeAsText(r)
    if (navigator.share) { try { await navigator.share({ title: r.name, text }) } catch { /* cancelled */ } } else { await navigator.clipboard.writeText(text); app.toast('Copied to clipboard') }
  }
  const exportOne = async () => {
    setMenu(false)
    const { writePaprikaFile } = await import('../lib/paprika.js') // the zip writer is a one-off
    const photos = await Promise.all((await photosOf(r.id)).map(async (p) => ({ idx: p.idx, bytes: new Uint8Array(await p.blob.arrayBuffer()) })))
    download(`${r.name}.paprikarecipes`, new Blob([writePaprikaFile([{ recipe: r, photos }])], { type: 'application/octet-stream' }))
  }
  const del = async () => { setMenu(false); await removeItem(r.id); app.back(); app.removed(`Deleted “${r.name}”`, r.id) }

  return (
    <Page className="recipe" title={r.name} onBack={app.back}
      actions={<><IconBtn icon="heart" label={r.favorite ? 'Remove from favorites' : 'Add to favorites'} active={r.favorite} onClick={() => set({ favorite: !r.favorite })} /><IconBtn icon="edit" label="Edit" onClick={() => app.push('edit', { id })} /><IconBtn icon="more" label="More actions" onClick={() => setMenu(true)} /></>}
      footer={<footer className="actionbar">
        <button className="btn primary" onClick={() => app.push('cook', { id, factor, system })}><Icon name="play" size={18} />Cook</button>
        <button className="btn" onClick={() => app.push('addToGroceries', { recipeIds: [id], factor })}><Icon name="cart" size={18} />Groceries</button>
        <button className="btn" onClick={() => app.push('addToPlan', { recipeId: id })}><Icon name="calendar" size={18} />Plan</button>
      </footer>}>
      <article className="recipe-body">
        {hero && <button className="hero" onClick={() => setGallery(true)} aria-label="View photos"><img src={hero} alt="" />{(r.photos || []).length > 1 && <span className="pill">{r.photos.length} photos</span>}</button>}
        <div className="recipe-head">
          <h1>{r.name}</h1>
          <div className="recipe-sub"><Stars value={r.rating} onChange={(v) => set({ rating: v })} />{r.source && (r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer">{r.source}</a> : <span>{r.source}</span>)}</div>
          <dl className="facts">
            {[['Prep', r.prep_time], ['Cook', r.cook_time], ['Total', r.total_time], ['Serves', servingsText], ['Difficulty', r.difficulty]].filter((x) => x[1]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {(r.categories || []).length > 0 && <div className="chips">{r.categories.map((c) => <span className="chip" key={c}>{c}</span>)}</div>}
        </div>
        {busy && <Busy label={busy} />}
        {r.description && <p className="desc">{r.description}</p>}
        <div className="cols">
          <section className="ingredients">
            <div className="sec-head"><h2>Ingredients</h2><button className={`pillbtn ${factor !== 1 || system !== 'original' ? 'on' : ''}`} onClick={() => setScaling(true)}><Icon name="scale" size={15} />{factor !== 1 ? `${formatNumber(factor)}×` : 'Scale'}{system !== 'original' ? ` · ${system === 'metric' ? 'Metric' : 'US'}` : ''}</button></div>
            <ul className="ings">
              {ings.map((l, i) => isHeader(l) ? <li key={i} className="ing-head">{l.replace(/^#+\s*|\*\*/g, '')}</li> : (
                <li key={i} className={done.has(i) ? 'done' : ''}><button onClick={() => { done.has(i) ? done.delete(i) : done.add(i); force((x) => x + 1) }}>{scaledIngs[i]}</button></li>
              ))}
              {!ings.length && <li className="muted">No ingredients listed.</li>}
            </ul>
          </section>
          <section className="directions">
            <div className="sec-head"><h2>Directions</h2></div>
            <ol className="steps">
              {steps.map((s, i) => isHeader(s) ? <li key={i} className="ing-head">{s}</li> : (
                <li key={i} className={step === i ? 'current' : ''} onClick={() => { stepAt.set(id, step === i ? -1 : i); force((x) => x + 1) }}><span className="step-n">{stepNums[i]}</span><p><StepText text={scaledSteps[i]} onTimer={app.startTimer} /></p></li>
              ))}
              {!steps.length && <li className="muted">No directions listed.</li>}
            </ol>
            {r.notes && <><div className="sec-head"><h2>Notes</h2></div><p className="notes">{r.notes}</p></>}
            {r.nutritional_info && <><div className="sec-head"><h2>Nutrition</h2></div><p className="notes nutrition">{r.nutritional_info}</p></>}
            {whatsIn.length > 0 && (
              <>
                <div className="sec-head"><h2>What&rsquo;s in it</h2></div>
                <div className="notable-list">{whatsIn.map((n) => <NotableCard key={n.id || n.label} n={n} />)}</div>
                <p className="muted small nudge">Interesting rather than prescriptive, and not medical advice.</p>
              </>
            )}
          </section>
        </div>
      </article>
      {scaling && (
        <Sheet title="Scale and convert" onClose={() => setScaling(false)}>
          <div className="seg">{SCALES.map((f) => <button key={f} className={Math.abs(factor - f) < 1e-9 ? 'on' : ''} onClick={() => setFactor(f)}>{formatNumber(f)}×</button>)}</div>
          {base ? (
            <>
              <span className="field-label">Servings</span>
              <NumStepper value={Math.round(base * factor * 100) / 100} onChange={(n) => setFactor(n / base)} unit="serving" min={0.25} max={500} label="Servings"
                hint={`Recipe makes ${formatNumber(base, { fractions: false })} — type any number`} />
            </>
          ) : (
            <>
              <span className="field-label">Multiply by</span>
              <NumStepper value={factor} onChange={setFactor} steps={SCALES} min={0.1} max={50} label="Scale" hint="Type any amount, e.g. 1.3" />
            </>
          )}
          <span className="field-label">Units</span>
          <div className="seg">{[['original', 'As written'], ['metric', 'Metric'], ['us', 'US']].map(([k, l]) => <button key={k} className={system === k ? 'on' : ''} onClick={() => setSetting('units', k)}>{l}</button>)}</div>
        </Sheet>
      )}
      {menu && (
        <Sheet title={r.name} onClose={() => setMenu(false)}>
          <div className="menu">
            <button onClick={() => { setMenu(false); app.push('logAdd', { recipeId: id, date: today(), meal: guessMeal() }) }}><Icon name="bowl" />Log that I ate this</button>
            <button onClick={() => { setMenu(false); set({ pinned: !r.pinned }); app.toast(r.pinned ? 'Unpinned' : 'Pinned to the top of Recipes') }}><Icon name="pin" />{r.pinned ? 'Unpin' : 'Pin to the top'}</button>
            <button onClick={() => { setMenu(false); app.push('addToMenu', { recipeId: id }) }}><Icon name="menu" />Add to a menu</button>
            <button onClick={nutrition} disabled={!hasAi()}><Icon name="chart" />Analyse nutrition{!hasAi() && <small>Needs Gemini key</small>}</button>
            <button onClick={share}><Icon name="share" />Share as text</button>
            <button onClick={() => { setMenu(false); setTimeout(() => window.print(), 200) }}><Icon name="print" />Print</button>
            <button onClick={exportOne}><Icon name="file" />Export for Paprika</button>
            <button className="danger" onClick={del}><Icon name="trash" />Delete recipe</button>
          </div>
        </Sheet>
      )}
      {gallery && <Gallery recipe={r} onClose={() => setGallery(false)} />}
    </Page>
  )
}
