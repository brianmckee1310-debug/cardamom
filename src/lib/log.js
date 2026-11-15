// The food log: one record per thing eaten, kept per person.
//
// Separate logs, not secret logs. Entries sync through the household like everything else, so
// each person's phone holds both sets; the Log tab only ever shows your own, found by `who`.
import { getSettings, listKind, saveItems, getItem } from '../store.js'
import { KEYS, cleanNut, scaleNut, sumNut, hasNut, parseNutText } from './nutrition.js'

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

/** Which meal it probably is, so logging at 8am does not default to Snack. */
export function guessMeal(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  return h < 10.5 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack'
}

/** Who this device is logging as: the signed-in user, or "me" before anyone signs in. */
export const myWho = () => getSettings().meId || 'me'

/**
 * Entries logged before sign-in belong to whoever then signs in on this device. Called once
 * after a successful sign-in so a week of offline logging is not orphaned.
 */
export async function adoptMine(uid) {
  if (!uid) return 0
  const mine = listKind('logentry').filter((e) => !e.who || e.who === 'me')
  const targets = listKind('target').filter((t) => !t.who || t.who === 'me')
  const all = [...mine, ...targets]
  if (all.length) await saveItems(all.map((e) => ({ ...e, who: uid })))
  return mine.length
}

export const myEntries = (who = myWho()) => listKind('logentry').filter((e) => e.who === who)
export const entriesOn = (date, who = myWho()) => myEntries(who).filter((e) => e.date === date)

/** What one entry actually contributes: its per-unit nutrition times how much was eaten. */
export const entryTotals = (e) => scaleNut(e?.per || {}, Number(e?.qty) || 0)
export const dayTotals = (entries) => sumNut((entries || []).map(entryTotals))

export function byMeal(entries) {
  const m = new Map(MEALS.map((x) => [x, []]))
  for (const e of entries || []) { const k = MEALS.includes(e.meal) ? e.meal : 'Snack'; m.get(k).push(e) }
  return MEALS.map((meal) => ({ meal, entries: m.get(meal) }))
}

/** Every notable from everything logged that day, de-duplicated, goodies first. */
export function dayNotables(entries) {
  const seen = new Set()
  const out = []
  for (const e of entries || []) for (const n of e.notables || []) {
    const key = (n.label || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key); out.push(n)
  }
  return [...out.filter((n) => n.t !== 'caution'), ...out.filter((n) => n.t === 'caution')]
}

/**
 * Targets are per person and sync, so they follow you to a second phone. The defaults are the
 * FDA Daily Values, which is a labelling reference rather than anyone's actual requirement —
 * the editor says so.
 */
export const DEFAULT_TARGET = { calories: 2000, protein_g: 50, carbohydrates_g: 275, fat_g: 78, fiber_g: 28 }
export const targetRecord = (who = myWho()) => listKind('target').find((t) => t.who === who) || null
export const targetFor = (who = myWho()) => ({ ...DEFAULT_TARGET, ...cleanNut(targetRecord(who)?.values || {}) })

/** Pull structured nutrition off a recipe, falling back to reading its text Nutrition field. */
export function recipeNut(r) {
  if (!r) return {}
  if (hasNut(r.nut)) return cleanNut(r.nut)
  return parseNutText(r.nutritional_info)
}

/** A log entry from a recipe: one unit is one serving of it. */
export function entryFromRecipe(r, { date, meal, qty = 1, who = myWho() }) {
  return {
    kind: 'logentry', who, date, meal, qty: Number(qty) || 1, unit: 'serving',
    name: r.name, recipeId: r.id, per: recipeNut(r), notables: r.notables || [], via: 'recipe', est: true,
  }
}

export const KCAL = 'calories'
/** Rough split of the day's calories between the three macros, for the summary bar. */
export function macroSplit(t) {
  const p = (t.protein_g || 0) * 4, c = (t.carbohydrates_g || 0) * 4, f = (t.fat_g || 0) * 9
  const sum = p + c + f
  return sum > 0 ? { protein: p / sum, carbs: c / sum, fat: f / sum, sum } : { protein: 0, carbs: 0, fat: 0, sum: 0 }
}

/** Entries over a span of days, oldest first — for the week strip and any later charting. */
export function daySeries(dates, who = myWho()) {
  const all = myEntries(who)
  return dates.map((date) => { const es = all.filter((e) => e.date === date); return { date, entries: es, totals: dayTotals(es) } })
}

export const describeEntry = (e) => {
  const q = Number(e.qty) || 0
  const unit = e.unit || 'serving'
  const n = q === 1 ? unit : /s$/.test(unit) ? unit : unit + 's'
  return `${q % 1 ? q.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : q} ${n}`
}

/** Copy a whole day onto another date, for "same as yesterday". */
export function copyDay(entries, toDate, who = myWho()) {
  return (entries || []).map(({ id, u, dirty, ...rest }) => ({ ...rest, kind: 'logentry', who, date: toDate }))
}

export { KEYS, getItem }
