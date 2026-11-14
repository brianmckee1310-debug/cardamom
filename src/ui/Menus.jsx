import React, { useState } from 'react'
import { useKind, useItem, saveItem, saveItems, removeItem, getItem } from '../store.js'
import { useApp, Page, Icon, IconBtn, Empty, Field, fmtDate, today } from './bits.jsx'
import { RecipeRow } from './Recipes.jsx'

export function Menus() {
  const app = useApp()
  const menus = useKind('menu')
  const [name, setName] = useState('')
  const add = async (e) => { e.preventDefault(); if (!name.trim()) return; const m = await saveItem({ kind: 'menu', name: name.trim(), recipeIds: [] }); setName(''); app.push('menu', { id: m.id }) }
  return (
    <Page title="Menus" onBack={app.back}>
      <form className="search add" onSubmit={add}><Icon name="plus" size={18} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New menu, e.g. Thanksgiving" aria-label="New menu name" />{name.trim() && <button className="btn small primary">Create</button>}</form>
      {!menus.length ? <Empty icon="menu" title="No menus yet">A menu is a set of recipes you can drop onto the planner or grocery list in one go.</Empty> : (
        <ul className="list">{[...menus].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <li key={m.id} className="row"><button className="row-main" onClick={() => app.push('menu', { id: m.id })}><span className="row-text"><b>{m.name}</b><small>{(m.recipeIds || []).filter((id) => getItem(id) && !getItem(id).deleted).length} recipes</small></span><Icon name="chevron" size={18} /></button></li>)}</ul>
      )}
    </Page>
  )
}

export function MenuView({ id }) {
  const app = useApp()
  const m = useItem(id)
  const [date, setDate] = useState(today())
  if (!m) return null
  const recipes = (m.recipeIds || []).map(getItem).filter((r) => r && !r.deleted)
  const plan = async (spread) => {
    await saveItems(recipes.map((r, i) => { const d = new Date(date + 'T12:00'); if (spread) d.setDate(d.getDate() + i); return { kind: 'meal', date: fmtDate(d), type: 'Dinner', recipeId: r.id, title: r.name } }))
    app.toast(`${recipes.length} added to the planner`)
  }
  return (
    <Page title={m.name} onBack={app.back} actions={<IconBtn icon="trash" label="Delete menu" onClick={async () => { await removeItem(m.id); app.back(); app.removed(`Deleted ${m.name}`, m.id) }} />}>
      <div className="form">
        <Field label="Name"><input value={m.name} onChange={(e) => saveItem({ ...m, name: e.target.value })} /></Field>
        <Field label="Notes"><input value={m.notes || ''} onChange={(e) => saveItem({ ...m, notes: e.target.value })} placeholder="Optional" /></Field>
      </div>
      <ul className="list">
        {recipes.map((r) => <RecipeRow key={r.id} recipe={r} onClick={() => app.push('recipe', { id: r.id })} right={<IconBtn icon="close" label={`Remove ${r.name}`} onClick={() => saveItem({ ...m, recipeIds: m.recipeIds.filter((x) => x !== r.id) })} />} />)}
      </ul>
      <div className="form">
        <button className="btn block" onClick={() => app.push('pick', { title: `Add to ${m.name}`, onPick: (ids) => saveItem({ ...getItem(m.id), recipeIds: [...new Set([...(getItem(m.id).recipeIds || []), ...ids])] }) })}><Icon name="plus" size={18} />Add recipes</button>
        {recipes.length > 0 && <>
          <button className="btn block" onClick={() => app.push('addToGroceries', { recipeIds: recipes.map((r) => r.id) })}><Icon name="cart" size={18} />Add all to groceries</button>
          <Field label="Put on the planner starting"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="rowline"><button className="btn grow" onClick={() => plan(false)}>All on that day</button><button className="btn grow" onClick={() => plan(true)}>One per day</button></div>
        </>}
      </div>
    </Page>
  )
}
