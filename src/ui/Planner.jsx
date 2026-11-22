import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useKind, useSettings, setSetting, saveItems, getItem, getSettings } from '../store.js'

import { useApp, Icon, IconBtn, Sheet, fmtDate, today } from './bits.jsx'
import { mealTypeList, buildIcs } from '../lib/ics.js'
import DragList from './DragList.jsx'
import { download } from './RecipeView.jsx'

const noon = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x }
// Which day a week begins on is a matter of taste and of country, so it is a setting.
// Sunday by default, which is what Brian uses.
export const weekStartDay = (settings) => Number(settings?.weekStart ?? 0)
const startOfWeek = (d, first = 0) => { const x = noon(d); x.setDate(x.getDate() - ((x.getDay() - first + 7) % 7)); return x }
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEK_START_CHOICES = DOW.map((name, i) => [String(i), name])
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const startOfMonth = (d) => { const x = noon(d); x.setDate(1); return x }
const short = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const weekday = (d) => d.toLocaleDateString(undefined, { weekday: 'long' })
const live = (id) => { const r = id && getItem(id); return r && !r.deleted ? r : null }

function useMealsByDay() {
  const meals = useKind('meal')
  const types = mealTypeList(useSettings())
  // Meal type decides the order, unless a day has been hand-sorted, which wins.
  const byDay = useMemo(() => { const m = new Map(); for (const x of meals) { if (!m.has(x.date)) m.set(x.date, []); m.get(x.date).push(x) } for (const l of m.values()) l.sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || (types.indexOf(a.type) + 1 || 99) - (types.indexOf(b.type) + 1 || 99)); return m }, [meals, types.join()])
  return { meals, byDay, types }
}

function DayCard({ d, list }) {
  const app = useApp()
  const key = fmtDate(d)
  const [adding, setAdding] = useState(false)
  const mealRow = (m) => (
    <>
      <button className="meal-main" onClick={() => live(m.recipeId) ? app.push('recipe', { id: m.recipeId }) : app.push('addToPlan', { meal: m })}><small>{m.type}</small><b>{m.title}</b>{m.note && <i>{m.note}</i>}</button>
      <IconBtn icon="edit" label={`Edit ${m.title}`} onClick={() => app.push('addToPlan', { meal: m })} />
    </>
  )
  const addRecipes = () => app.push('pick', { title: 'Plan which recipes?', onPick: async (ids) => { await saveItems(ids.map((id) => ({ kind: 'meal', date: key, type: 'Dinner', recipeId: id, title: getItem(id).name }))); app.toast(`${ids.length} planned`) } })
  return (
    <section className={`day ${key === today() ? 'today' : ''}`}>
      <header><b>{weekday(d)}</b><small>{short(d)}</small>
        <IconBtn icon="plus" label={`Add to ${weekday(d)}`} className="accent" onClick={() => setAdding(true)} />
      </header>
      {adding && (
        <Sheet title={weekday(d)} onClose={() => setAdding(false)}>
          <div className="menu">
            <button onClick={() => { setAdding(false); addRecipes() }}><Icon name="book" />Add recipes</button>
            <button onClick={() => { setAdding(false); app.push('addToPlan', { date: key }) }}><Icon name="edit" />Something else</button>
          </div>
        </Sheet>
      )}
      {list.length > 1
        ? <DragList className="plain bare" items={list} itemClass="meal" labelOf={(m) => m.title} onReorder={(next) => saveItems(next.map((m, n) => ({ ...m, ord: n })))} renderItem={mealRow} />
        : list.map((m) => <div className="meal" key={m.id}>{mealRow(m)}</div>)}
      {!list.length && <p className="day-empty">Nothing planned</p>}
    </section>
  )
}

export default function Planner() {
  const app = useApp()
  const settings = useSettings()
  const view = settings.planView === 'month' ? 'month' : 'week'
  const { meals, byDay } = useMealsByDay()
  const first = weekStartDay(settings)
  const [start, setStart] = useState(() => startOfWeek(new Date(), weekStartDay(getSettings())))
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [picked, setPicked] = useState(today())
  const [menu, setMenu] = useState(false)
  const [dir, setDir] = useState(0)
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(start, n))
  const week = days.flatMap((d) => byDay.get(fmtDate(d)) || [])
  const weekRecipeIds = [...new Set(week.map((m) => m.recipeId).filter(live))]
  const range = `${short(days[0])} – ${short(days[6])}`
  useEffect(() => { setStart((p) => startOfWeek(p, first)) }, [first])
  const move = (n) => {
    setDir(n)
    if (view === 'week') setStart(n === 0 ? startOfWeek(new Date(), first) : addDays(start, n * 7))
    else { const m = n === 0 ? startOfMonth(new Date()) : new Date(month.getFullYear(), month.getMonth() + n, 1, 12); setMonth(m); if (n === 0) setPicked(today()) }
  }
  const cells = useMemo(() => { const first0 = startOfWeek(month, first); const all = Array.from({ length: 42 }, (_, i) => addDays(first0, i)); return all[35].getMonth() === month.getMonth() ? all : all.slice(0, 35) }, [month, first])
  const pickedDate = noon(picked + 'T12:00')
  const toGroceries = () => app.push('addToGroceries', { recipeIds: weekRecipeIds })

  return (
    <>
      <header className="top">
        <div className="top-title stack"><h1>Planner</h1><small>{view === 'week' ? range : month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</small></div>
        <IconBtn icon="back" label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => move(-1)} />
        <button className="btn small" onClick={() => move(0)}>Today</button>
        <IconBtn icon="chevron" label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => move(1)} />
        <IconBtn icon="more" label="Planner actions" onClick={() => setMenu(true)} />
      </header>
      <div className="planbar">
        <div className="seg slim"><button className={view === 'week' ? 'on' : ''} onClick={() => setSetting('planView', 'week')}>Week</button><button className={view === 'month' ? 'on' : ''} onClick={() => setSetting('planView', 'month')}>Month</button></div>
        {view === 'week' && <>
          <button className="pillbtn" disabled={!weekRecipeIds.length} onClick={toGroceries}><Icon name="cart" size={16} />To groceries</button>
          <button className="pillbtn" onClick={() => app.push('weekGlance', { start: fmtDate(start) })} aria-label="Week at a glance"><Icon name="expand" size={16} />Glance</button>
        </>}
      </div>
      {view === 'week' ? (
        <div className={`week slide${dir}`} key={fmtDate(start)}>
          {days.map((d) => <DayCard key={fmtDate(d)} d={d} list={byDay.get(fmtDate(d)) || []} />)}
        </div>
      ) : (
        <div className={`week slide${dir}`} key={fmtDate(month)}>
          <div className="month" role="grid">
            {Array.from({ length: 7 }, (_, i) => DOW[(first + i) % 7][0]).map((w, i) => <span key={i} className="month-w">{w}</span>)}
            {cells.map((d) => { const key = fmtDate(d); const list = byDay.get(key) || []; return (
              <button key={key} className={`month-d ${d.getMonth() !== month.getMonth() ? 'dim' : ''} ${key === today() ? 'today' : ''} ${key === picked ? 'on' : ''}`} onClick={() => setPicked(key)} aria-label={`${weekday(d)} ${short(d)}, ${list.length} planned`}>
                <b>{d.getDate()}</b>
                <span className="month-dots">{list.slice(0, 3).map((m) => <i key={m.id} />)}</span>
              </button>
            ) })}
          </div>
          <DayCard d={pickedDate} list={byDay.get(picked) || []} />
        </div>
      )}
      {menu && (
        <Sheet title={view === 'week' ? range : 'Planner'} onClose={() => setMenu(false)}>
          <div className="menu">
            {view === 'week' && <button disabled={!weekRecipeIds.length} onClick={() => { setMenu(false); toGroceries() }}><Icon name="cart" />Add this week to groceries</button>}
            {view === 'week' && <button onClick={() => { setMenu(false); app.push('weekGlance', { start: fmtDate(start) }) }}><Icon name="expand" />Week at a glance</button>}
            <button onClick={() => { setMenu(false); setTimeout(() => window.print(), 250) }}><Icon name="printer" />Print {view === 'week' ? 'this week' : 'this month'}</button>
            <button onClick={() => { setMenu(false); app.push('mealTypes') }}><Icon name="calendar" />Meal types and their order</button>
            <button onClick={() => { setMenu(false); app.push('menus') }}><Icon name="menu" />Add a saved menu</button>
            <button disabled={!meals.length} onClick={() => { setMenu(false); download('cardamom-meals.ics', buildIcs(meals), 'text/calendar') }}><Icon name="calendar" />Download calendar file</button>
            {view === 'week' && <button disabled={!week.length} className="danger" onClick={async () => { setMenu(false); await saveItems(week.map((m) => ({ ...m, deleted: true }))); app.removed('Week cleared', week.map((m) => m.id)) }}><Icon name="trash" />Clear this week</button>}
          </div>
        </Sheet>
      )}
    </>
  )
}

/**
 * The whole week on one screen with nothing over it: no tab bar, no buttons on the rows, no
 * photos. Made to be screenshotted and texted. The type shrinks until all seven days fit.
 */
export function WeekGlance({ start }) {
  const app = useApp()
  const { byDay } = useMealsByDay()
  const first = noon(start + 'T12:00')
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(first, n))
  const box = useRef(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => { const el = box.current; if (el && el.scrollHeight > el.clientHeight + 1 && scale > 0.5) setScale((s) => Math.round((s - 0.06) * 100) / 100) })
  return (
    <section className="glance" role="dialog" aria-label="Week at a glance">
      <header><h2>{short(days[0])} – {short(days[6])}</h2><IconBtn icon="close" label="Close" onClick={app.back} /></header>
      <div className="glance-days" ref={box} style={{ fontSize: `${scale}em` }}>
        {days.map((d) => { const list = byDay.get(fmtDate(d)) || []; return (
          <div key={fmtDate(d)} className={`glance-day ${fmtDate(d) === today() ? 'today' : ''}`}>
            <span className="glance-when"><b>{d.toLocaleDateString(undefined, { weekday: 'short' })}</b><small>{d.getDate()}</small></span>
            <span className="glance-what">{list.length ? list.map((m) => <span key={m.id}>{m.type !== 'Dinner' && <small>{m.type} </small>}{m.title}</span>) : <i>—</i>}</span>
          </div>
        ) })}
      </div>
    </section>
  )
}
