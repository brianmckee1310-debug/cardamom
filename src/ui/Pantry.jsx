import React, { useMemo, useState } from 'react'
import { useKind, saveItem } from '../store.js'
import { useApp, Icon, IconBtn, Empty, today } from './bits.jsx'
import { AISLE_ORDER } from '../lib/ingredients.js'
import { groupBy, quickItem } from './Grocery.jsx'

export default function Pantry() {
  const app = useApp()
  const items = useKind('pantry')
  const [text, setText] = useState('')
  const groups = useMemo(() => groupBy([...items].sort((a, b) => a.name.localeCompare(b.name)), (i) => i.aisle || 'Other', AISLE_ORDER), [items])
  const add = async (e) => { e.preventDefault(); if (!text.trim()) return; await saveItem({ ...quickItem(text, 'pantry'), inStock: true }); setText('') }
  const soon = (d) => d && d <= new Date(Date.now() + 5 * 864e5).toLocaleDateString('en-CA')
  return (
    <>
      <header className="top">
        <div className="top-title"><h1>Pantry</h1><small>{items.filter((i) => i.inStock !== false).length} in stock</small></div>
        <IconBtn icon="barcode" label="Scan a barcode" onClick={() => app.push('barcode', { target: 'pantry' })} />
      </header>
      <form className="search add" onSubmit={add}><Icon name="plus" size={18} /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add what you have on hand" aria-label="Add pantry item" enterKeyHint="done" />{text.trim() && <button className="btn small primary">Add</button>}</form>
      {!items.length ? <Empty icon="jar" title="Nothing in the pantry yet">Items here are skipped when you add a recipe to your grocery list.</Empty> : (
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
