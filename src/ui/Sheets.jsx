import React, { useMemo, useState } from 'react'
import { useKind, getItem, saveItems, saveItem, removeItem, listKind, useSettings, setSetting } from '../store.js'
import { mergeIntoList, looseMatch } from '../lib/grocery.js'
import { useDoubleTap } from './Grocery.jsx'
import { useApp, Sheet, Icon, Field, fmtDate, today } from './bits.jsx'
import { RecipeRow, searchRecipes } from './Recipes.jsx'
import { splitLines, scaleLine, isHeader, groceryFromLine, guessAisle, AISLE_ORDER } from '../lib/ingredients.js'
import { MEAL_TYPES } from '../lib/ics.js'

export const inPantry = (name, pantry) => pantry.some((p) => p.inStock !== false && looseMatch(name, p.name))

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

/**
 * Send one recipe, or a whole week of them, to a shopping list. Each line is tapped on or off;
 * a double tap marks it "check at home first" for when you are not standing in the kitchen.
 */
export function AddToGroceries({ recipeIds, factor = 1 }) {
  const app = useApp()
  const pantry = useKind('pantry')
  const lists = useKind('glist')
  const settings = useSettings()
  const [list, setList] = useState(lists.some((l) => l.id === settings.glist) ? settings.glist : '')
  const isDouble = useDoubleTap()
  const groups = useMemo(() => { let i = 0; return recipeIds.map((id) => getItem(id)).filter((r) => r && !r.deleted).map((r) => ({ recipe: r, lines: splitLines(r.ingredients).filter((l) => !isHeader(l)).map((l) => { const line = scaleLine(l, factor); const g = groceryFromLine(line); return { recipe: r, line, ...g, i: i++, have: inPantry(g.name, pantry) } }) })) }, [])
  const lines = groups.flatMap((g) => g.lines)
  const [state, setState] = useState(() => Object.fromEntries(lines.map((l) => [l.i, l.have ? 'off' : 'on'])))
  const tap = (l) => setState((s) => ({ ...s, [l.i]: isDouble(l.i) ? (navigator.vibrate?.(25), 'check') : s[l.i] === 'on' ? 'off' : 'on' }))
  const setAll = (g, on) => setState((s) => ({ ...s, ...Object.fromEntries(g.lines.map((l) => [l.i, on ? (s[l.i] === 'check' ? 'check' : 'on') : 'off'])) }))
  const picked = lines.filter((l) => state[l.i] !== 'off')
  const add = async () => {
    const existing = listKind('grocery').filter((e) => (e.list || '') === list)
    const out = mergeIntoList(existing, picked.map((l) => ({ kind: 'grocery', name: l.name, qty: l.qty, aisle: guessAisle(l.name), recipe: l.recipe.name, recipeId: l.recipe.id, done: false, check: state[l.i] === 'check', list: list || undefined })))
    await saveItems(out)
    const combined = picked.length - out.filter((o) => !o.id).length
    if (picked.some((l) => state[l.i] === 'check') && !settings.usedCheck) setSetting('usedCheck', true)
    app.back(); app.toast(`${picked.length} item${picked.length === 1 ? '' : 's'} added${combined > 0 ? `, ${combined} combined` : ''}`)
  }
  return (
    <Sheet title="Add to groceries" onClose={app.back} tall>
      {lists.length > 0 && <div className="lists inset">{[{ id: '', name: 'Groceries' }, ...lists].map((l) => <button key={l.id} className={`pillbtn ${list === l.id ? 'on' : ''}`} onClick={() => setList(l.id)}>{l.name}</button>)}</div>}
      <p className="hint inset">Tap to include or skip. Double tap if you need to check at home first.</p>
      {groups.map((g) => { const on = g.lines.filter((l) => state[l.i] !== 'off').length; return (
        <section key={g.recipe.id} className="addgroup">
          {groups.length > 1 && <h3 className="group-h flush">{g.recipe.name}<button className="group-x" onClick={() => setAll(g, on === 0)}>{on === 0 ? 'All' : 'None'}</button></h3>}
          <ul className="list plain checks">
            {g.lines.map((l) => (
              <li key={l.i} className={`row ${state[l.i] === 'check' ? 'ask' : ''}`}><button className="row-main" onClick={() => tap(l)}>
                <span className={`tick ${state[l.i] === 'off' ? '' : 'on'} ${state[l.i] === 'check' ? 'ask' : ''}`}><Icon name={state[l.i] === 'check' ? 'help' : 'check'} size={16} /></span>
                <span className="row-text"><b>{l.line}</b>{state[l.i] === 'check' ? <small className="warn">Check at home first</small> : l.have && <small>We should have this</small>}</span>
              </button></li>
            ))}
          </ul>
        </section>
      ) })}
      {!lines.length && <p className="muted pad">No ingredients to add.</p>}
      <button className="btn primary block sticky" disabled={!picked.length} onClick={add}>Add {picked.length} item{picked.length === 1 ? '' : 's'}</button>
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
  const lists = useKind('glist')
  const save = async () => { if (!x.name.trim()) return; await saveItem({ ...x, name: x.name.trim() }); app.back() }
  return (
    <Sheet title={item.id ? 'Edit item' : 'New item'} onClose={app.back}>
      <Field label="Name"><input value={x.name} onChange={up('name')} autoFocus={!item.id} /></Field>
      <div className="grid2">
        <Field label="Amount"><input value={x.qty || ''} onChange={up('qty')} /></Field>
        <Field label="Aisle"><select value={x.aisle || 'Other'} onChange={up('aisle')}>{AISLE_ORDER.map((a) => <option key={a}>{a}</option>)}</select></Field>
      </div>
      {!pantry && lists.length > 0 && <Field label="List"><select value={x.list || ''} onChange={(e) => setX((v) => ({ ...v, list: e.target.value || undefined }))}><option value="">Groceries</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>}
      {pantry && <Field label="Use by"><input type="date" value={x.expires || ''} onChange={up('expires')} /></Field>}
      <div className="rowline">
        {item.id && <button className="btn danger" onClick={async () => { await removeItem(item.id); app.back(); app.removed(`Removed ${item.name}`, item.id) }}>Delete</button>}
        <button className="btn primary grow" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}
