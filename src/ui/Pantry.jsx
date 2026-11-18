import React, { useMemo, useState } from 'react'
import { useKind, saveItem, useSettings } from '../store.js'
import { useApp, Icon, IconBtn, Empty, today } from './bits.jsx'
import { aisleList } from '../lib/ingredients.js'
import { groupBy } from './Grocery.jsx'
import { quickItem } from '../lib/grocery.js'
import { cookable } from '../lib/grocery.js'
import { Page } from './bits.jsx'

export default function Pantry() {
  const app = useApp()
  const items = useKind('pantry')
  const settings = useSettings()
  const [text, setText] = useState('')
  const groups = useMemo(() => groupBy([...items].sort((a, b) => a.name.localeCompare(b.name)), (i) => i.aisle || 'Other', aisleList(settings)), [items])
  const add = async (e) => { e.preventDefault(); if (!text.trim()) return; await saveItem({ ...quickItem(text, 'pantry', aisleList(settings)), inStock: true }); setText('') }
  const soon = (d) => d && d <= new Date(Date.now() + 5 * 864e5).toLocaleDateString('en-CA')
  return (
    <>
      <header className="top">
        <div className="top-title"><h1>Pantry</h1><small>{items.filter((i) => i.inStock !== false).length} in stock</small></div>
        <IconBtn icon="barcode" label="Scan a barcode" onClick={() => app.push('barcode', { target: 'pantry' })} />
      </header>
      {items.length > 0 && <button className="btn block" onClick={() => app.push('cookable')}><Icon name="sparkle" size={18} />What can I make?</button>}
      <form className="search add" onSubmit={add}><Icon name="plus" size={18} /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add what you have on hand" aria-label="Add pantry item" enterKeyHint="done" />{text.trim() && <button className="btn small primary">Add</button>}</form>
      {!items.length ? <Empty icon="jar" title="Nothing here yet">This fills itself in: clear purchased groceries with “remember we have them” and they land here. It is then used to skip things you already have and to suggest what you can cook.</Empty> : (
        <div className="groups">{groups.map(([g, list]) => (
          <section key={g}><h3 className="group-h">{g}</h3>
            <ul className="list checks">{list.map((i) => (
              <li key={i.id} className={`row ${i.inStock === false ? 'out' : ''}`}>
                <button className="row-main" onClick={() => saveItem({ ...i, inStock: i.inStock === false })} aria-pressed={i.inStock !== false}><span className={`tick ${i.inStock !== false ? 'on' : ''}`}><Icon name="check" size={15} /></span><span className="row-text"><b>{i.name}</b><small className={soon(i.expires) ? 'warn' : ''}>{[i.qty, i.inStock === false ? 'Out' : '', i.expires ? `${i.expires < today() ? 'Expired' : 'Use by'} ${new Date(i.expires + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''].filter(Boolean).join(' · ')}</small></span></button>
                <IconBtn icon="cart" label={`Add ${i.name} to groceries`} onClick={async () => { await saveItem({ kind: 'grocery', name: i.name, qty: '', aisle: i.aisle, done: false }); app.toast(`${i.name} added to groceries`) }} />
                <IconBtn icon="edit" label={`Edit ${i.name}`} onClick={() => app.push('itemEdit', { item: i })} />
              </li>
            ))}</ul>
          </section>
        ))}</div>
      )}
    </>
  )
}

/** Recipes ranked by how much of them is already in the house. */
export function Cookable() {
  const app = useApp()
  const recipes = useKind('recipe')
  const pantry = useKind('pantry')
  const list = useMemo(() => cookable(recipes, pantry), [recipes, pantry])
  return (
    <Page title="What can I make?" onBack={app.back}>
      {!list.length ? <Empty icon="jar" title="Nothing close yet">No recipe is at least half covered by what is in the pantry.</Empty> : (
        <ul className="list">{list.map(({ recipe: r, got, total, missing }) => (
          <li key={r.id} className="row">
            <button className="row-main" onClick={() => app.push('recipe', { id: r.id })}><span className="row-text"><b>{r.name}</b><small className={missing.length ? '' : 'have-all'}>{missing.length ? `Have ${got} of ${total} · need ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}` : `Have all ${total}`}</small></span></button>
            {missing.length > 0 && <IconBtn icon="cart" label={`Add what ${r.name} needs to groceries`} onClick={() => app.push('addToGroceries', { recipeIds: [r.id] })} />}
          </li>
        ))}</ul>
      )}
      <p className="muted small pad">Water, salt and pepper are assumed. Only as accurate as the pantry list.</p>
    </Page>
  )
}
