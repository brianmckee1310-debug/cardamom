import React, { useMemo, useRef, useState } from 'react'
import { useKind, useSettings, setSetting, saveItem, saveItems, getItem } from '../store.js'
import { useApp, Icon, IconBtn, Empty, Sheet, Field, today } from './bits.jsx'
import { aisleList } from '../lib/ingredients.js'
import DragList from './DragList.jsx'
import { Dictate } from './Voice.jsx'
import { mergeIntoList, pantryUpserts, quickItem } from '../lib/grocery.js'

export function groupBy(items, key, order) {
  const m = new Map()
  for (const it of items) { const k = key(it); if (!m.has(k)) m.set(k, []); m.get(k).push(it) }
  return [...m.entries()].sort((a, b) => (order ? (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99) : a[0].localeCompare(b[0])))
}

/** A second tap on the same row inside this window means "not sure we need this". */
export const DOUBLE_TAP_MS = 350
export function useDoubleTap() {
  const last = useRef({ key: null, t: 0 })
  return (key) => { const now = Date.now(); const dbl = last.current.key === key && now - last.current.t < DOUBLE_TAP_MS; last.current = dbl ? { key: null, t: 0 } : { key, t: now }; return dbl }
}

export default function Grocery() {
  const app = useApp()
  const all = useKind('grocery')
  const lists = useKind('glist')
  const pantry = useKind('pantry')
  const settings = useSettings()
  const cur = lists.some((l) => l.id === settings.glist) ? settings.glist : ''
  const curList = lists.find((l) => l.id === cur)
  const [text, setText] = useState('')
  const [by, setBy] = useState('aisle')
  const [sheet, setSheet] = useState(null) // clear | new | list
  const [name, setName] = useState('')
  const isDouble = useDoubleTap()

  const items = useMemo(() => all.filter((i) => (i.list || '') === cur), [all, cur])
  const checks = items.filter((i) => i.check && !i.done)
  const rest = items.filter((i) => !(i.check && !i.done))
  // Within an aisle, a hand-sorted order wins; anything never dragged falls in alphabetically after it.
  const sorted = useMemo(() => [...rest].sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || a.name.localeCompare(b.name)), [all, cur])
  const groups = useMemo(() => groupBy(sorted, (i) => (by === 'aisle' ? i.aisle || 'Other' : i.recipe || 'Added by hand'), by === 'aisle' ? aisleList(settings) : null), [sorted, by, settings.aisles])
  const done = items.filter((i) => i.done)
  const count = (id) => all.filter((i) => (i.list || '') === id && !i.done).length

  const add = async (e) => {
    e.preventDefault(); if (!text.trim()) return
    const inc = { ...quickItem(text, 'grocery', aisleList(settings)), done: false, list: cur || undefined }
    const out = mergeIntoList(items, [inc])
    await saveItems(out); setText('')
    if (out[0].id) app.toast(`Combined with ${out[0].name} already on the list`)
  }
  const tap = (i) => {
    const now = getItem(i.id) || i
    if (isDouble(i.id)) { navigator.vibrate?.(25); saveItem({ ...now, done: false, check: true }); if (!settings.usedCheck) setSetting('usedCheck', true) }
    else saveItem({ ...now, done: !now.done })
  }
  const haveIt = async (i) => {
    const made = await saveItems(pantryUpserts(pantry, [i], today()))
    await saveItem({ ...i, deleted: true })
    app.toast(`${i.name}: have it`, { undo: async () => { await saveItem({ ...i, deleted: false }); await saveItems(made.filter((m) => !pantry.some((p) => p.id === m.id)).map((m) => ({ ...m, deleted: true }))) } })
  }
  const clear = async (toPantry) => {
    setSheet(null)
    const made = toPantry ? await saveItems(pantryUpserts(pantry, done, today())) : []
    await saveItems(done.map((i) => ({ ...i, deleted: true })))
    app.toast(toPantry ? `${done.length} moved to pantry` : `${done.length} cleared`, { undo: async () => { await saveItems(done.map((i) => ({ ...i, deleted: false }))); await saveItems(made.filter((m) => !pantry.some((p) => p.id === m.id)).map((m) => ({ ...m, deleted: true }))) } })
  }
  const removeGroup = async (label, list) => { await saveItems(list.map((i) => ({ ...i, deleted: true }))); app.removed(`${label} removed from the list`, list.map((i) => i.id)) }
  const newList = async (e) => { e.preventDefault(); if (!name.trim()) return; const l = await saveItem({ kind: 'glist', name: name.trim() }); await setSetting('glist', l.id); setName(''); setSheet(null) }
  const renameList = async (e) => { e.preventDefault(); if (!name.trim()) return; await saveItem({ ...curList, name: name.trim() }); setSheet(null) }
  const deleteList = async () => { setSheet(null); await saveItems([...items.map((i) => ({ ...i, deleted: true })), { ...curList, deleted: true }]); await setSetting('glist', ''); app.removed(`${curList.name} deleted`, [curList.id, ...items.map((i) => i.id)]) }

  const row = (i) => (
    <>
      <button className="row-main" onClick={() => tap(i)} aria-pressed={!!i.done}><span className={`tick round ${i.done ? 'on' : ''}`}><Icon name="check" size={15} /></span><span className="row-text"><b>{i.name}</b><small>{[i.qty, by === 'aisle' ? i.recipe : i.aisle].filter(Boolean).join(' · ')}</small></span></button>
      <IconBtn icon="edit" label={`Edit ${i.name}`} onClick={() => app.push('itemEdit', { item: i })} />
    </>
  )
  return (
    <>
      <header className="top">
        <div className="top-title"><h1>{curList ? curList.name : 'Groceries'}</h1><small>{items.length - done.length} to get</small></div>
        <IconBtn icon={by === 'aisle' ? 'filter' : 'book'} label={by === 'aisle' ? 'Group by recipe' : 'Group by aisle'} onClick={() => setBy(by === 'aisle' ? 'recipe' : 'aisle')} />
        <IconBtn icon="barcode" label="Scan a barcode" onClick={() => app.push('barcode', { target: 'grocery' })} />
        <IconBtn icon="more" label="List actions" onClick={() => { setName(curList?.name || ''); setSheet('list') }} />
      </header>
      <div className="lists" role="tablist" aria-label="Lists">
        <button role="tab" aria-selected={!cur} className={`pillbtn ${!cur ? 'on' : ''}`} onClick={() => setSetting('glist', '')}>Groceries{count('') > 0 && <i>{count('')}</i>}</button>
        {lists.map((l) => <button role="tab" aria-selected={cur === l.id} key={l.id} className={`pillbtn ${cur === l.id ? 'on' : ''}`} onClick={() => setSetting('glist', l.id)}>{l.name}{count(l.id) > 0 && <i>{count(l.id)}</i>}</button>)}
        <button className="pillbtn ghost" onClick={() => { setName(''); setSheet('new') }}><Icon name="plus" size={15} />List</button>
      </div>
      <form className="search add" onSubmit={add}><Icon name="plus" size={18} /><input value={text} onChange={(e) => setText(e.target.value)} placeholder={curList ? `Add to ${curList.name}` : 'Add an item, e.g. 2 lb carrots'} aria-label="Add item" enterKeyHint="done" /><Dictate label="Say an item" onText={(t) => setText(t)} />{text.trim() && <button className="btn small primary">Add</button>}</form>
      {!items.length ? <Empty icon="cart" title="This list is empty">{curList ? 'Add items above.' : 'Add items above, or send a whole week over from the Planner.'}</Empty> : (
        <div className="groups">
          {checks.length > 0 && (
            <section className="tocheck">
              <h3 className="group-h">Check at home first</h3>
              <ul className="list">{checks.map((i) => (
                <li key={i.id} className="row">
                  <span className="row-main static"><span className="row-text"><b>{i.name}</b><small>{[i.qty, i.recipe].filter(Boolean).join(' · ')}</small></span></span>
                  <button className="btn small" onClick={() => haveIt(i)}>Have it</button>
                  <button className="btn small primary" onClick={() => saveItem({ ...i, check: false })}>Need it</button>
                </li>
              ))}</ul>
            </section>
          )}
          {!settings.usedCheck && rest.length > 0 && <p className="hint">Not sure you need something? Double tap it to check at home first.</p>}
          {groups.map(([g, list]) => (
            <section key={g}>
              <h3 className="group-h">{g}{by === 'recipe' && g !== 'Added by hand' && <button className="group-x" onClick={() => removeGroup(g, list)} aria-label={`Remove ${g} from the list`}>Remove</button>}</h3>
              {by === 'aisle'
                ? <DragList className="checks" items={list} labelOf={(i) => i.name} itemClass="" rowClass={(i) => (i.done ? "done" : "")} onReorder={(next) => saveItems(next.map((it, n) => ({ ...it, ord: n })))} renderItem={row} />
                : <ul className="list checks">{list.map((i) => <li key={i.id} className={`row ${i.done ? 'done' : ''}`}>{row(i)}</li>)}</ul>}
            </section>
          ))}
          {done.length > 0 && <button className="btn block" onClick={() => setSheet('clear')}>Clear {done.length} purchased</button>}
        </div>
      )}
      {sheet === 'clear' && <Sheet title={`${done.length} purchased`} onClose={() => setSheet(null)}><div className="menu"><button onClick={() => clear(true)}><Icon name="jar" />Clear, and remember we have them</button><button onClick={() => clear(false)}><Icon name="trash" />Just clear them</button></div></Sheet>}
      {sheet === 'new' && <Sheet title="New list" onClose={() => setSheet(null)}><form onSubmit={newList}><Field label="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Costco, hardware store" /></Field><button className="btn primary block" disabled={!name.trim()}>Create</button></form></Sheet>}
      {sheet === 'list' && (
        <Sheet title={curList ? curList.name : 'Groceries'} onClose={() => setSheet(null)}>
          {curList && <form className="rowline" onSubmit={renameList}><input value={name} onChange={(e) => setName(e.target.value)} aria-label="List name" /><button className="btn" disabled={!name.trim() || name.trim() === curList.name}>Rename</button></form>}
          <div className="menu">
            <button disabled={!items.length} onClick={() => { setSheet(null); setTimeout(() => window.print(), 250) }}><Icon name="printer" />Print this list</button>
            <button onClick={() => { setSheet(null); app.push('aisles') }}><Icon name="grid" />Aisles and their order</button>
            {curList && <button className="danger" onClick={deleteList}><Icon name="trash" />Delete this list and its items</button>}
          </div>
        </Sheet>
      )}
    </>
  )
}
