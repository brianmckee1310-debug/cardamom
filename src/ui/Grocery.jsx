import React, { useMemo, useState } from 'react'
import { useKind, saveItem, saveItems, removeItem } from '../store.js'
import { useApp, Icon, IconBtn, Empty, Sheet } from './bits.jsx'
import { guessAisle, AISLE_ORDER, parseIngredient, groceryFromLine } from '../lib/ingredients.js'

export function groupBy(items, key, order) {
  const m = new Map()
  for (const it of items) { const k = key(it); if (!m.has(k)) m.set(k, []); m.get(k).push(it) }
  return [...m.entries()].sort((a, b) => (order ? (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99) : a[0].localeCompare(b[0])))
}
export const quickItem = (text, kind) => { const g = parseIngredient(text).qty != null ? groceryFromLine(text) : { qty: '', name: text.trim() }; return { kind, name: g.name, qty: g.qty, aisle: guessAisle(g.name) } }

export default function Grocery() {
  const app = useApp()
  const items = useKind('grocery')
  const [text, setText] = useState('')
  const [by, setBy] = useState('aisle')
  const [clearing, setClearing] = useState(false)
  const groups = useMemo(() => groupBy([...items].sort((a, b) => a.name.localeCompare(b.name)), (i) => (by === 'aisle' ? i.aisle || 'Other' : i.recipe || 'Added by hand'), by === 'aisle' ? AISLE_ORDER : null), [items, by])
  const done = items.filter((i) => i.done)
  const add = async (e) => { e.preventDefault(); if (!text.trim()) return; await saveItem({ ...quickItem(text, 'grocery'), done: false }); setText('') }
  const clear = async (toPantry) => {
    setClearing(false)
    const made = toPantry ? await saveItems(done.map((i) => ({ kind: 'pantry', name: i.name, qty: i.qty, aisle: i.aisle, inStock: true }))) : []
    await saveItems(done.map((i) => ({ ...i, deleted: true })))
    app.toast(toPantry ? `${done.length} moved to pantry` : `${done.length} cleared`, { undo: async () => { await saveItems(done.map((i) => ({ ...i, deleted: false }))); await saveItems(made.map((i) => ({ ...i, deleted: true }))) } })
  }
  return (
    <>
      <header className="top">
        <div className="top-title"><h1>Groceries</h1><small>{items.length - done.length} to get</small></div>
        <IconBtn icon={by === 'aisle' ? 'filter' : 'book'} label={by === 'aisle' ? 'Group by recipe' : 'Group by aisle'} onClick={() => setBy(by === 'aisle' ? 'recipe' : 'aisle')} />
        <IconBtn icon="barcode" label="Scan a barcode" onClick={() => app.push('barcode', { target: 'grocery' })} />
      </header>
      <form className="search add" onSubmit={add}><Icon name="plus" size={18} /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item, e.g. 2 lb carrots" aria-label="Add grocery item" enterKeyHint="done" />{text.trim() && <button className="btn small primary">Add</button>}</form>
      {!items.length ? <Empty icon="cart" title="Your list is empty">Add items above, or open a recipe and tap Groceries.</Empty> : (
        <div className="groups">
          {groups.map(([g, list]) => (
            <section key={g}><h3 className="group-h">{g}</h3>
              <ul className="list checks">{list.map((i) => (
                <li key={i.id} className={`row ${i.done ? 'done' : ''}`}>
                  <button className="row-main" onClick={() => saveItem({ ...i, done: !i.done })} aria-pressed={!!i.done}><span className={`tick round ${i.done ? 'on' : ''}`}><Icon name="check" size={15} /></span><span className="row-text"><b>{i.name}</b><small>{[i.qty, by === 'aisle' ? i.recipe : i.aisle].filter(Boolean).join(' · ')}</small></span></button>
                  <IconBtn icon="edit" label={`Edit ${i.name}`} onClick={() => app.push('itemEdit', { item: i })} />
                </li>
              ))}</ul>
            </section>
          ))}
          {done.length > 0 && <button className="btn block" onClick={() => setClearing(true)}>Clear {done.length} purchased</button>}
        </div>
      )}
      {clearing && <Sheet title={`${done.length} purchased`} onClose={() => setClearing(false)}><div className="menu"><button onClick={() => clear(true)}><Icon name="jar" />Move to pantry</button><button onClick={() => clear(false)}><Icon name="trash" />Just clear them</button></div></Sheet>}
    </>
  )
}
