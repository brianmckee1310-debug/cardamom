import React, { useMemo, useState } from 'react'
import { useKind, saveItem, saveItems, removeItem, getItem } from '../store.js'
import { useApp, Sheet, Icon, IconBtn, Field, Busy, NumStepper, fmtDate, today } from './bits.jsx'
import { NUTRIENTS, GROUPS, BY_KEY, HEADLINE, fmtKey, cleanNut, hasNut, nutText, scaleNut } from '../lib/nutrition.js'
import { MEALS, guessMeal, myWho, recipeNut, targetRecord, targetFor, DEFAULT_TARGET } from '../lib/log.js'
import { matchNotables, notablesForRecipe, mergeNotables } from '../lib/notables.js'
import { analyseNutrition, foodFromDescription } from '../lib/gemini.js'
import { aiCfg, hasAi } from '../lib/importers.js'
import { RecipeRow, searchRecipes } from './Recipes.jsx'
import { NotableCard } from './FoodLog.jsx'

/**
 * What one logged portion is, in the recipe's own words.
 * "2" -> "one of 2 servings"; "2 servings" -> "one of 2 servings" (not "servings servings");
 * "makes 12 cookies" -> left as it stands, because "one of ... servings" would be nonsense.
 */
export function portionText(servings) {
  const raw = String(servings ?? '').trim()
  if (!raw) return ''
  if (/^[\d.,/\s]+$/.test(raw)) return `one of ${raw.trim()} servings`
  if (/servings?\b/i.test(raw)) return `one of ${raw}`
  return raw
}

const QTYS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]
/** Amount for one logged thing: step it, or type any amount (1.3 portions). */
const QtyStepper = ({ qty, setQty, unit }) => (
  <NumStepper value={qty} onChange={setQty} unit={unit} steps={QTYS} min={0.05} max={99} label="How much" />
)

/** Compact look at what one entry contributes. */
export function NutPreview({ per, qty = 1 }) {
  const t = scaleNut(per || {}, qty)
  const extra = NUTRIENTS.filter((n) => !HEADLINE.includes(n.k) && t[n.k] > 0)
  if (!hasNut(t)) return <p className="banner"><Icon name="info" size={16} />No numbers for this one. It will still appear in the log, just without nutrition.</p>
  return (
    <div className="nutpreview">
      <div className="nutpreview-top">{HEADLINE.map((k) => <span key={k}><b>{fmtKey(k, t[k])}</b><small>{BY_KEY[k].label}</small></span>)}</div>
      {extra.length > 0 && <p className="muted small">Also carries {extra.slice(0, 8).map((n) => n.label).join(', ')}{extra.length > 8 ? ` and ${extra.length - 8} more` : ''}.</p>}
    </div>
  )
}

/**
 * Log something. Four ways in: a recipe you have, a scanned package, a plain description that
 * the AI costs out, or typed numbers. They all end at the same confirm step.
 */
export default function LogAdd({ date: d0, meal: m0, recipeId, draft: draft0 }) {
  const app = useApp()
  const recipes = useKind('recipe')
  const who = myWho()
  const [date, setDate] = useState(d0 || today())
  const [meal, setMeal] = useState(m0 || guessMeal())
  const [mode, setMode] = useState(recipeId || draft0 ? 'confirm' : 'menu')
  const [draft, setDraft] = useState(() => (draft0 ? draft0 : recipeId ? fromRecipe(getItem(recipeId)) : null))
  const [qty, setQty] = useState(draft0?.qty || 1)
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [manual, setManual] = useState({ name: '', unit: 'serving', calories: '', protein_g: '', carbohydrates_g: '', fat_g: '' })

  function fromRecipe(r) {
    if (!r) return null
    return { name: r.name, unit: 'serving', per: recipeNut(r), notables: mergeNotables(notablesForRecipe(r), r.notables), recipeId: r.id, via: 'recipe', portion: portionText(r.servings) }
  }
  const pickRecipe = (r) => { setDraft(fromRecipe(r)); setQty(1); setMode('confirm') }

  const estimateRecipe = async () => {
    const r = getItem(draft.recipeId)
    setBusy('Estimating nutrition'); setErr('')
    try {
      const { values, text: txt, notables, servings } = await analyseNutrition(aiCfg(), r)
      await saveItem({ ...r, nut: values, nutritional_info: txt, notables: mergeNotables(notablesForRecipe(r), notables), nutServings: servings || r.servings })
      setDraft((x) => ({ ...x, per: values, notables: mergeNotables(notablesForRecipe(r), notables) }))
    } catch (e) { setErr(e.message || String(e)) }
    setBusy('')
  }

  const describe = async () => {
    setBusy('Working out what that was'); setErr('')
    try {
      const f = await foodFromDescription(aiCfg(), text)
      setDraft({ name: f.name, unit: 'portion', per: f.per, portion: f.portion, notables: mergeNotables(matchNotables(`${f.name}\n${text}`), f.notables), via: 'ai', caveat: f.caveat })
      setQty(1); setMode('confirm')
    } catch (e) { setErr(e.message || String(e)) }
    setBusy('')
  }

  const useManual = () => {
    const per = cleanNut({ calories: parseFloat(manual.calories), protein_g: parseFloat(manual.protein_g), carbohydrates_g: parseFloat(manual.carbohydrates_g), fat_g: parseFloat(manual.fat_g) })
    setDraft({ name: manual.name.trim(), unit: manual.unit.trim() || 'serving', per, notables: matchNotables(manual.name), via: 'manual' })
    setQty(1); setMode('confirm')
  }

  const save = async () => {
    await saveItem({ kind: 'logentry', who, date, meal, qty, unit: draft.unit || 'serving', name: draft.name, per: draft.per || {}, notables: draft.notables || [], recipeId: draft.recipeId || null, barcode: draft.barcode || null, portion: draft.portion || '', via: draft.via || 'manual' })
    app.back(); app.toast(`${draft.name} logged`)
  }

  const shown = useMemo(() => [...searchRecipes(recipes, q)].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60), [recipes, q])
  const title = { menu: 'Log food', recipe: 'Which recipe?', describe: 'Describe what you ate', manual: 'Type it in', confirm: 'Log this' }[mode]

  return (
    <Sheet title={title} onClose={app.back} tall={mode === 'recipe'}>
      {err && <p className="banner err"><Icon name="alert" size={16} />{err}</p>}
      {busy && <Busy label={busy} />}

      {mode === 'menu' && !busy && (
        <div className="menu tiles">
          <button onClick={() => setMode('recipe')}><Icon name="book" /><span><b>From a recipe</b><small>Uses the recipe&rsquo;s own nutrition</small></span></button>
          <button onClick={() => app.replace('barcode', { target: 'log', date, meal })}><Icon name="barcode" /><span><b>Scan a package</b><small>Most accurate: straight off the label</small></span></button>
          <button disabled={!hasAi()} onClick={() => setMode('describe')}><Icon name="sparkle" /><span><b>Describe it</b><small>{hasAi() ? '"Two eggs and buttered toast"' : 'Needs the Gemini key in More'}</small></span></button>
          <button onClick={() => setMode('manual')}><Icon name="edit" /><span><b>Type it in</b><small>Numbers off a label or another app</small></span></button>
        </div>
      )}

      {mode === 'recipe' && !busy && (
        <>
          <div className="search"><Icon name="search" size={18} /><input type="search" autoFocus placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <ul className="list plain">{shown.map((r) => <RecipeRow key={r.id} recipe={r} onClick={() => pickRecipe(r)} right={hasNut(recipeNut(r)) ? <span className="pill">{Math.round(recipeNut(r).calories || 0)} cal</span> : null} />)}</ul>
          {!shown.length && <p className="muted pad">No recipes match.</p>}
        </>
      )}

      {mode === 'describe' && !busy && (
        <form onSubmit={(e) => { e.preventDefault(); describe() }}>
          <Field label="What did you eat?" hint="Amounts help: a cup, two slices, a handful."><textarea rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="A bowl of oatmeal with blueberries and a spoon of peanut butter" /></Field>
          <button className="btn primary block" disabled={text.trim().length < 3}>Work it out</button>
        </form>
      )}

      {mode === 'manual' && !busy && (
        <form onSubmit={(e) => { e.preventDefault(); manual.name.trim() && useManual() }}>
          <Field label="What"><input autoFocus value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} placeholder="Greek yoghurt" /></Field>
          <div className="grid2">
            <Field label="Unit"><input value={manual.unit} onChange={(e) => setManual((m) => ({ ...m, unit: e.target.value }))} placeholder="serving" /></Field>
            <Field label="Calories"><input value={manual.calories} onChange={(e) => setManual((m) => ({ ...m, calories: e.target.value }))} inputMode="decimal" /></Field>
          </div>
          <div className="grid2">
            <Field label="Protein (g)"><input value={manual.protein_g} onChange={(e) => setManual((m) => ({ ...m, protein_g: e.target.value }))} inputMode="decimal" /></Field>
            <Field label="Carbs (g)"><input value={manual.carbohydrates_g} onChange={(e) => setManual((m) => ({ ...m, carbohydrates_g: e.target.value }))} inputMode="decimal" /></Field>
          </div>
          <Field label="Fat (g)"><input value={manual.fat_g} onChange={(e) => setManual((m) => ({ ...m, fat_g: e.target.value }))} inputMode="decimal" /></Field>
          <button className="btn primary block" disabled={!manual.name.trim()}>Next</button>
        </form>
      )}

      {mode === 'confirm' && draft && !busy && (
        <>
          <p className="lead">{draft.name}</p>
          {draft.portion && <p className="muted small nudge">{draft.via === 'ai' ? 'Estimated for' : 'Portion'}: {draft.portion}</p>}
          <QtyStepper qty={qty} setQty={setQty} unit={draft.unit || 'serving'} />
          <NutPreview per={draft.per} qty={qty} />
          {draft.recipeId && !hasNut(draft.per) && hasAi() && <button className="btn block" onClick={estimateRecipe}><Icon name="sparkle" size={18} />Estimate this recipe&rsquo;s nutrition</button>}
          {draft.caveat && <p className="muted small nudge">{draft.caveat}</p>}
          <span className="field-label">Meal</span>
          <div className="seg">{MEALS.map((m) => <button key={m} className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>{m}</button>)}</div>
          <Field label="Day"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {(draft.notables || []).length > 0 && (
            <>
              <span className="field-label">What&rsquo;s in it</span>
              <div className="notable-list">{draft.notables.slice(0, 4).map((n) => <NotableCard key={n.id || n.label} n={n} />)}</div>
            </>
          )}
          <button className="btn primary block sticky" onClick={save}>Log it</button>
        </>
      )}
    </Sheet>
  )
}

/** Edit or remove one logged entry. */
export function LogEntry({ entry }) {
  const app = useApp()
  const [qty, setQty] = useState(Number(entry.qty) || 1)
  const [meal, setMeal] = useState(entry.meal)
  const [date, setDate] = useState(entry.date)
  const save = async () => { await saveItem({ ...entry, qty, meal, date }); app.back() }
  return (
    <Sheet title={entry.name} onClose={app.back}>
      <QtyStepper qty={qty} setQty={setQty} unit={entry.unit || 'serving'} />
      <NutPreview per={entry.per} qty={qty} />
      <span className="field-label">Meal</span>
      <div className="seg">{MEALS.map((m) => <button key={m} className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>{m}</button>)}</div>
      <Field label="Day"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      {entry.recipeId && getItem(entry.recipeId) && !getItem(entry.recipeId).deleted && (
        <button className="btn block" onClick={async () => { await app.back(); app.push('recipe', { id: entry.recipeId }) }}><Icon name="book" size={18} />Open the recipe</button>
      )}
      {(entry.notables || []).length > 0 && <div className="notable-list">{entry.notables.map((n) => <NotableCard key={n.id || n.label} n={n} />)}</div>}
      <div className="rowline">
        <button className="btn danger" onClick={async () => { await removeItem(entry.id); app.back(); app.removed(`Removed ${entry.name}`, entry.id) }}>Remove</button>
        <button className="btn primary grow" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

/** Daily targets, per person. Stored as an item so they sync to the other phone. */
export function LogTargets() {
  const app = useApp()
  useKind('target')
  const who = myWho()
  const rec = targetRecord(who)
  const [v, setV] = useState(() => { const t = targetFor(who); return Object.fromEntries(Object.keys(DEFAULT_TARGET).map((k) => [k, String(Math.round(t[k])) ])) })
  const up = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))
  const save = async () => {
    const values = cleanNut(Object.fromEntries(Object.entries(v).map(([k, s]) => [k, parseFloat(s)])))
    await saveItem({ ...(rec || {}), kind: 'target', who, values })
    app.back(); app.toast('Targets saved')
  }
  return (
    <Sheet title="Daily targets" onClose={app.back}>
      <p className="muted small nudge">Yours alone — your targets and your log are separate from anyone else in the household. The starting numbers are the FDA Daily Values used on food labels, which are a general reference and not a personal recommendation; a dietitian or doctor is the right source for that.</p>
      <div className="grid2">
        <Field label="Calories"><input value={v.calories} onChange={up('calories')} inputMode="numeric" /></Field>
        <Field label="Protein (g)"><input value={v.protein_g} onChange={up('protein_g')} inputMode="numeric" /></Field>
      </div>
      <div className="grid2">
        <Field label="Carbs (g)"><input value={v.carbohydrates_g} onChange={up('carbohydrates_g')} inputMode="numeric" /></Field>
        <Field label="Fat (g)"><input value={v.fat_g} onChange={up('fat_g')} inputMode="numeric" /></Field>
      </div>
      <Field label="Fiber (g)"><input value={v.fiber_g} onChange={up('fiber_g')} inputMode="numeric" /></Field>
      <div className="rowline">
        <button className="btn" onClick={() => setV(Object.fromEntries(Object.entries(DEFAULT_TARGET).map(([k, n]) => [k, String(n)])))}>Daily Values</button>
        <button className="btn primary grow" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}
