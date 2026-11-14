import React, { useMemo, useState } from 'react'
import { useKind, saveItems, getItem } from '../store.js'
import { useApp, Icon, IconBtn, Sheet, fmtDate, today } from './bits.jsx'
import { MEAL_TYPES, buildIcs } from '../lib/ics.js'
import { download } from './RecipeView.jsx'

const startOfWeek = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export default function Planner() {
  const app = useApp()
  const meals = useKind('meal')
  const [start, setStart] = useState(() => startOfWeek(new Date()))
  const [menu, setMenu] = useState(false)
  const [dir, setDir] = useState(0)
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(start, n))
  const byDay = useMemo(() => { const m = new Map(); for (const x of meals) { if (!m.has(x.date)) m.set(x.date, []); m.get(x.date).push(x) } for (const l of m.values()) l.sort((a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type)); return m }, [meals])
  const week = days.flatMap((d) => byDay.get(fmtDate(d)) || [])
  const move = (n) => { setDir(n); setStart(n === 0 ? startOfWeek(new Date()) : addDays(start, n * 7)) }
  const addRecipes = (date) => app.push('pick', { title: 'Plan which recipes?', onPick: async (ids) => { await saveItems(ids.map((id) => ({ kind: 'meal', date, type: 'Dinner', recipeId: id, title: getItem(id).name }))); app.toast(`${ids.length} planned`) } })
  const range = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  return (
    <>
      <header className="top">
        <div className="top-title stack"><h1>Planner</h1><small>{range}</small></div>
        <IconBtn icon="back" label="Previous week" onClick={() => move(-1)} />
        <button className="btn small" onClick={() => move(0)}>Today</button>
        <IconBtn icon="chevron" label="Next week" onClick={() => move(1)} />
        <IconBtn icon="more" label="Week actions" onClick={() => setMenu(true)} />
      </header>
      <div className={`week slide${dir}`} key={fmtDate(start)}>
        {days.map((d) => { const key = fmtDate(d); const list = byDay.get(key) || []; return (
          <section key={key} className={`day ${key === today() ? 'today' : ''}`}>
            <header><b>{d.toLocaleDateString(undefined, { weekday: 'long' })}</b><small>{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
              <IconBtn icon="book" label={`Add recipes to ${d.toLocaleDateString(undefined, { weekday: 'long' })}`} onClick={() => addRecipes(key)} />
              <IconBtn icon="plus" label={`Add note to ${d.toLocaleDateString(undefined, { weekday: 'long' })}`} onClick={() => app.push('addToPlan', { date: key })} />
            </header>
            {list.map((m) => (
              <div className="meal" key={m.id}>
                <button className="meal-main" onClick={() => m.recipeId && getItem(m.recipeId) && !getItem(m.recipeId).deleted ? app.push('recipe', { id: m.recipeId }) : app.push('addToPlan', { meal: m })}><small>{m.type}</small><b>{m.title}</b>{m.note && <i>{m.note}</i>}</button>
                <IconBtn icon="edit" label={`Edit ${m.title}`} onClick={() => app.push('addToPlan', { meal: m })} />
              </div>
            ))}
            {!list.length && <p className="day-empty">Nothing planned</p>}
          </section>
        ) })}
      </div>
      {menu && (
        <Sheet title={range} onClose={() => setMenu(false)}>
          <div className="menu">
            <button disabled={!week.some((m) => m.recipeId)} onClick={() => { setMenu(false); app.push('addToGroceries', { recipeIds: [...new Set(week.map((m) => m.recipeId).filter((id) => id && getItem(id) && !getItem(id).deleted))] }) }}><Icon name="cart" />Add this week to groceries</button>
            <button onClick={() => { setMenu(false); app.push('menus') }}><Icon name="menu" />Add a saved menu</button>
            <button disabled={!meals.length} onClick={() => { setMenu(false); download('cardamom-meals.ics', buildIcs(meals), 'text/calendar') }}><Icon name="calendar" />Download calendar file</button>
            <button disabled={!week.length} className="danger" onClick={async () => { setMenu(false); await saveItems(week.map((m) => ({ ...m, deleted: true }))); app.removed('Week cleared', week.map((m) => m.id)) }}><Icon name="trash" />Clear this week</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
