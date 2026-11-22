import React, { useMemo, useState } from 'react'
import { useKind, saveItems } from '../store.js'
import { useApp, Icon, IconBtn, Sheet, Empty, fmtDate, today } from './bits.jsx'
import { NUTRIENTS, GROUPS, BY_KEY, fmtKey, pctDv } from '../lib/nutrition.js'
import { MEALS, guessMeal, myWho, entriesOn, dayTotals, entryTotals, byMeal, dayNotables, targetFor, daySeries, describeEntry, copyDay } from '../lib/log.js'

export const addDays = (date, n) => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() + n); return fmtDate(d) }
const longDate = (date) => new Date(date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

/** Calories against the day's target. The ring fills by CSS transition, so it animates on change. */
function Ring({ used, target }) {
  const R = 38, C = 2 * Math.PI * R
  const frac = target > 0 ? Math.min(used / target, 1) : 0
  const over = target > 0 && used > target
  const left = Math.round(target - used)
  return (
    <div className={`ring ${over ? 'over' : ''}`}>
      <svg viewBox="0 0 96 96" width="104" height="104" aria-hidden="true">
        <circle className="ring-track" cx="48" cy="48" r={R} />
        <circle className="ring-fill" cx="48" cy="48" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <div className="ring-mid">
        <b>{Math.round(used)}</b>
        <small>of {target}</small>
      </div>
      <span className="ring-note">{over ? `${-left} over` : `${left} left`}</span>
    </div>
  )
}

function Bar({ k, value, target }) {
  const n = BY_KEY[k]
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="nbar">
      <span className="nbar-head"><b>{n.label}</b><small>{fmtKey(k, value)}{target ? ` / ${Math.round(target)}` : ''}</small></span>
      <span className="nbar-track"><i style={{ width: `${pct}%` }} /></span>
    </div>
  )
}

/** One nutrient row in the full table: amount, and a bar showing percent of the Daily Value. */
function NutRow({ k, value }) {
  const n = BY_KEY[k]
  const pct = pctDv(k, value)
  return (
    <li className="nutrow">
      <span className="nutrow-label">{n.label}</span>
      <span className="nutrow-amt">{fmtKey(k, value)}</span>
      <span className="nutrow-bar">{pct != null && <i style={{ width: `${Math.min(pct, 100)}%` }} className={pct >= 100 ? 'full' : ''} />}</span>
      <span className="nutrow-pct">{pct != null ? `${pct}%` : ''}</span>
    </li>
  )
}

export function NotableCard({ n }) {
  return (
    <div className={`notable ${n.t === 'caution' ? 'caution' : 'good'}`}>
      <span className="notable-head"><Icon name={n.t === 'caution' ? 'alert' : 'leaf'} size={16} /><b>{n.label}</b></span>
      <p>{n.text}</p>
    </div>
  )
}

export default function FoodLog() {
  const app = useApp()
  const all = useKind('logentry')
  useKind('target') // subscribe: a target change should redraw the rings
  const who = myWho()
  const [date, setDate] = useState(today())
  const [dir, setDir] = useState(0)
  const [open, setOpen] = useState(false)
  const [allNotables, setAllNotables] = useState(false)
  const [menu, setMenu] = useState(false)

  const entries = useMemo(() => entriesOn(date, who), [all, date, who])
  const totals = useMemo(() => dayTotals(entries), [entries])
  const target = targetFor(who)
  const meals = byMeal(entries)
  const notables = dayNotables(entries)
  const week = useMemo(() => daySeries([6, 5, 4, 3, 2, 1, 0].map((n) => addDays(date, -n)), who), [all, date, who])
  const present = NUTRIENTS.filter((n) => totals[n.k] != null && totals[n.k] > 0)
  const missing = NUTRIENTS.length - present.length
  const go = (n) => { setDir(n); setDate(n === 0 ? today() : addDays(date, n)) }
  const add = (meal) => app.push('logAdd', { date, meal })

  return (
    <>
      <header className="top">
        <div className="top-title stack"><h1>Log</h1><small>{date === today() ? 'Today' : longDate(date)}</small></div>
        <IconBtn icon="back" label="Previous day" onClick={() => go(-1)} />
        {date !== today() && <button className="btn small" onClick={() => go(0)}>Today</button>}
        <IconBtn icon="chevron" label="Next day" onClick={() => go(1)} />
        <IconBtn icon="barcode" label="Scan a barcode" onClick={() => app.push('barcode', { target: 'log', date, meal: guessMeal() })} />
        <IconBtn icon="more" label="Log actions" onClick={() => setMenu(true)} />
        <IconBtn icon="plus" label="Log food" className="accent" onClick={() => add(guessMeal())} />
      </header>

      <div className="logweek">
        {week.map(({ date: d, totals: t }) => {
          const h = target.calories > 0 ? Math.min((t.calories || 0) / target.calories, 1.15) : 0
          return (
            <button key={d} className={`logweek-day ${d === date ? 'on' : ''}`} onClick={() => { setDir(0); setDate(d) }} aria-label={`${longDate(d)}, ${Math.round(t.calories || 0)} calories`}>
              <span className="logweek-bar"><i style={{ height: `${h * 100}%` }} /></span>
              <small>{new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</small>
            </button>
          )
        })}
      </div>

      <div className={`logday slide${dir}`} key={date}>
        <section className="card daysum">
          <Ring used={totals.calories || 0} target={target.calories} />
          <div className="daysum-bars">
            <Bar k="protein_g" value={totals.protein_g || 0} target={target.protein_g} />
            <Bar k="carbohydrates_g" value={totals.carbohydrates_g || 0} target={target.carbohydrates_g} />
            <Bar k="fat_g" value={totals.fat_g || 0} target={target.fat_g} />
            <Bar k="fiber_g" value={totals.fiber_g || 0} target={target.fiber_g} />
          </div>
        </section>

        {!entries.length && <Empty icon="bowl" title="Nothing logged yet">Tap + to log a recipe, scan a package, or just describe what you ate.</Empty>}

        {meals.map(({ meal, entries: list }) => (list.length || entries.length) ? (
          <section className="day" key={meal}>
            <header>
              <b>{meal}</b>
              <small>{list.length ? `${Math.round(dayTotals(list).calories || 0)} cal` : ''}</small>
              <IconBtn icon="plus" label={`Log ${meal.toLowerCase()}`} onClick={() => add(meal)} />
            </header>
            {list.map((e) => (
              <div className="logrow" key={e.id}>
                <button className="logrow-main" onClick={() => app.push('logEntry', { entry: e })}>
                  <span className="row-text"><b>{e.name}</b><small>{describeEntry(e)}{e.portion ? ` · ${e.portion}` : ''}{e.via === 'product' ? ' · label' : e.via === 'ai' ? ' · estimated' : ''}</small></span>
                  <span className="logrow-cal">{Math.round(entryTotals(e).calories || 0)}</span>
                </button>
              </div>
            ))}
            {!list.length && <p className="day-empty">Nothing yet</p>}
          </section>
        ) : null)}

        {entries.length > 0 && (
          <>
            <button className={`btn block between ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <span>All nutrients</span><Icon name="chevron" size={16} className={`ico turn ${open ? 'down' : ''}`} />
            </button>
            {open && (
              <section className="card nuts">
                {GROUPS.map(([g, label]) => {
                  const rows = present.filter((n) => n.group === g)
                  if (!rows.length) return null
                  return (
                    <div key={g} className="nutgroup">
                      <h3>{label}</h3>
                      <ul>{rows.map((n) => <NutRow key={n.k} k={n.k} value={totals[n.k]} />)}</ul>
                    </div>
                  )
                })}
                <p className="muted small">
                  Bars are percent of the FDA Daily Value — a food-label reference for adults, not your own requirement.
                  {missing > 0 && ` No data for ${missing} other nutrient${missing === 1 ? '' : 's'}.`}
                </p>
                <p className="muted small">These are estimates. Macros are usually in the right neighbourhood; vitamins and minerals swing widely with soil, variety, season and cooking, so read them as a hint about what a meal is rich in, not as a measurement.</p>
              </section>
            )}

            {notables.length > 0 && (
              <section className="card notables">
                <h3>What&rsquo;s in today</h3>
                <div className="notable-list">
                  {(allNotables ? notables : notables.slice(0, 4)).map((n) => <NotableCard key={n.id || n.label} n={n} />)}
                </div>
                {notables.length > 4 && <button className="btn small" onClick={() => setAllNotables((v) => !v)}>{allNotables ? 'Show fewer' : `Show all ${notables.length}`}</button>}
                <p className="muted small">Interesting rather than prescriptive, and not medical advice. Cautions usually apply to particular people — pregnancy, kidney stones, a medication — rather than everyone.</p>
              </section>
            )}
          </>
        )}
      </div>

      {menu && (
        <Sheet title={longDate(date)} onClose={() => setMenu(false)}>
          <div className="menu">
            <button onClick={() => { setMenu(false); app.push('logRange', { date }) }}><Icon name="chart" />Week and month view</button>
            <button onClick={() => { setMenu(false); app.push('logTargets', {}) }}><Icon name="gear" />Daily targets</button>
            <button disabled={!entriesOn(addDays(date, -1), who).length} onClick={async () => { setMenu(false); const y = entriesOn(addDays(date, -1), who); await saveItems(copyDay(y, date, who)); app.toast(`${y.length} copied from yesterday`) }}><Icon name="paste" />Copy yesterday onto this day</button>
            <button onClick={() => { setMenu(false); app.push('logAdd', { date, meal: guessMeal() }) }}><Icon name="plus" />Log something else</button>
            <button disabled={!entries.length} className="danger" onClick={async () => { setMenu(false); await saveItems(entries.map((e) => ({ ...e, deleted: true }))); app.removed('Day cleared', entries.map((e) => e.id)) }}><Icon name="trash" />Clear this day</button>
          </div>
        </Sheet>
      )}
    </>
  )
}
