import React, { useMemo, useState } from 'react'
import { useKind, getItem, saveItems, saveItem, removeItem, listKind } from '../store.js'
import { useApp, Sheet, Icon, Field, fmtDate, today } from './bits.jsx'
import { RecipeRow, searchRecipes } from './Recipes.jsx'
import { splitLines, scaleLine, isHeader, groceryFromLine, guessAisle, AISLE_ORDER } from '../lib/ingredients.js'
import { MEAL_TYPES } from '../lib/ics.js'

const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\b(fresh|large|small|medium|chopped|diced|minced|sliced|ground|dried|of)\b/g, '').replace(/s\b/g, '').replace(/\s+/g, ' ').trim()
export const inPantry = (name, pantry) => { const n = norm(name); return !!n && pantry.some((p) => p.inStock !== false && (() => { const k = norm(p.name); return k && (n === k || n.includes(k) || k.includes(n)) })()) }

/** Choose one or more recipes. onPick(ids) */
export function RecipePicker({ title = 'Choose recipes', onPick, multi = true }) {
  const app = useApp()
  const recipes = useKind('recipe')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState([])
  const shown = useMemo(() => [...searchRecipes(recipes, q)].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80), [recipes, q])
  const done = (ids) => app.back().then(() => onPick(ids))
  return (
    <Sheet title={title} onClose={app.back} tall>
      <div className="search"><Icon name="search" size={18} /><input type="search" autoFocus placeholder="Search recipes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ul className="list plain">
        {shown.map((r) => <RecipeRow key={r.id} recipe={r} onClick={() => multi ? setSel((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]) : done([r.id])} right={multi && <span className={`tick ${sel.includes(r.id) ? 'on' : ''}`}><Icon name="check" size={16} /></span>} />)}
      </ul>
      {multi && <button className="btn primary block sticky" disabled={!sel.length} onClick={() => done(sel)}>Add {sel.length || ''}</button>}
    </Sheet>
  )
}

export function AddToGroceries({ recipeIds, factor = 1 }) {
  const app = useApp()
  const pantry = useKind('pantry')
  const lines = useMemo(() => recipeIds.flatMap((id) => { const r = getItem(id); return r ? splitLines(r.ingredients).filter((l) => !isHeader(l)).map((l) => ({ recipe: r, line: scaleLine(l, factor) })) : [] }).map((x, i) => { const g = groceryFromLine(x.line); return { ...x, ...g, i, have: inPantry(g.name, pantry) } }), [])
  const [off, setOff] = useState(() => new Set(lines.filter((l) => l.have).map((l) => l.i)))
  const add = async () => {
    const picked = lines.filter((l) => !off.has(l.i))
    await saveItems(picked.map((l) => ({ kind: 'grocery', name: l.name, qty: l.qty, aisle: guessAisle(l.name), recipe: l.recipe.name, recipeId: l.recipe.id, done: false })))
    app.back(); app.toast(`${picked.length} item${picked.length === 1 ? '' : 's'} added to groceries`)
  }
  return (
    <Sheet title="Add to groceries" onClose={app.back} tall>
      <ul className="list plain checks">
        {lines.map((l) => (
          <li key={l.i} className="row"><button className="row-main" onClick={() => setOff((s) => { const n = new Set(s); n.has(l.i) ? n.delete(l.i) : n.add(l.i); return n })}>
            <span className={`tick ${off.has(l.i) ? '' : 'on'}`}><Icon name="check" size={16} /></span>
            <span className="row-text"><b>{l.line}</b>{l.have && <small>In your pantry</small>}{recipeIds.length > 1 && <small>{l.recipe.name}</small>}</span>
          </button></li>
        ))}
        {!lines.length && <li className="muted pad">No ingredients to add.</li>}
      </ul>
      <button className="btn primary block sticky" disabled={lines.length === off.size} onClick={add}>Add {lines.length - off.size} items</button>
    </Sheet>
  )
}

export function AddToPlan({ recipeId, date, meal }) {
  const app = useApp()
  const r = recipeId ? getItem(recipeId) : meal?.recipeId ? getItem(meal.recipeId) : null
  const [d, setD] = useState(meal?.date || date || today())
  const [type, setType] = useState(meal?.type || 'Dinner')
  const [title, setTitle] = useState(meal?.title || r?.name || '')
  const [note, setNote] = useState(meal?.note || '')
  const save = async () => {
    if (!title.trim()) return
    await saveItem({ ...(meal || {}), kind: 'meal', date: d, type, title: title.trim(), note, recipeId: recipeId || meal?.recipeId || null })
    app.back(); app.toast(meal ? 'Meal updated' : `Planned for ${new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`)
  }
  const quick = [0, 1, 2, 3, 4, 5, 6].map((n) => { const x = new Date(); x.setDate(x.getDate() + n); return x })
  return (
    <Sheet title={meal ? 'Edit meal' : 'Add to meal plan'} onClose={app.back}>
      {r ? <p className="lead">{r.name}</p> : <Field label="What"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leftovers, dinner out, pizza night" autoFocus /></Field>}
      <span className="field-label">Day</span>
      <div className="daychips">{quick.map((x) => <button key={fmtDate(x)} className={d === fmtDate(x) ? 'on' : ''} onClick={() => setD(fmtDate(x))}><small>{x.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>{x.getDate()}</b></button>)}</div>
      <Field label="Other date"><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
      <span className="field-label">Meal</span>
      <div className="seg">{MEAL_TYPES.map((t) => <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>)}</div>
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
      <div className="rowline">
        {meal && <button className="btn danger" onClick={async () => { await removeItem(meal.id); app.back(); app.removed('Meal removed', meal.id) }}>Remove</button>}
        <button className="btn primary grow" onClick={save}>{meal ? 'Save' : 'Add to plan'}</button>
      </div>
    </Sheet>
  )
}

export function AddToMenu({ recipeId }) {
  const app = useApp()
  const menus = useKind('menu')
  const [name, setName] = useState('')
  const add = async (m) => { await saveItem({ ...m, recipeIds: [...new Set([...(m.recipeIds || []), recipeId])] }); app.back(); app.toast(`Added to ${m.name}`) }
  return (
    <Sheet title="Add to a menu" onClose={app.back}>
      <ul className="list plain">{menus.map((m) => <li key={m.id} className="row"><button className="row-main" onClick={() => add(m)}><span className="row-text"><b>{m.name}</b><small>{(m.recipeIds || []).length} recipes</small></span></button></li>)}</ul>
      <div className="rowline"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New menu name" aria-label="New menu name" /><button className="btn primary" disabled={!name.trim()} onClick={() => add({ kind: 'menu', name: name.trim(), recipeIds: [] })}>Create</button></div>
    </Sheet>
  )
}

/** Edit a grocery or pantry item. */
export function ItemEdit({ item }) {
  const app = useApp()
  const [x, setX] = useState(item)
  const up = (k) => (e) => setX((v) => ({ ...v, [k]: e.target.value }))
  const pantry = item.kind === 'pantry'
  const save = async () => { if (!x.name.trim()) return; await saveItem({ ...x, name: x.name.trim() }); app.back() }
  return (
    <Sheet title={item.id ? 'Edit item' : 'New item'} onClose={app.back}>
      <Field label="Name"><input value={x.name} onChange={up('name')} autoFocus={!item.id} /></Field>
      <div className="grid2">
        <Field label="Amount"><input value={x.qty || ''} onChange={up('qty')} /></Field>
        <Field label="Aisle"><select value={x.aisle || 'Other'} onChange={up('aisle')}>{AISLE_ORDER.map((a) => <option key={a}>{a}</option>)}</select></Field>
      </div>
      {pantry && <Field label="Use by"><input type="date" value={x.expires || ''} onChange={up('expires')} /></Field>}
      <div className="rowline">
        {item.id && <button className="btn danger" onClick={async () => { await removeItem(item.id); app.back(); app.removed(`Removed ${item.name}`, item.id) }}>Delete</button>}
        <button className="btn primary grow" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}
