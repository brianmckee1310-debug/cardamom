// Turn plain text (clipboard, caption) into a recipe draft without AI.
import { parseIngredient } from './ingredients.js'
const ING_H = /^\W*(ingredients?|what you('|’)?ll need|you('|’)?ll need)\W*$/i
const DIR_H = /^\W*(directions?|instructions?|method|steps?|preparation|how to make( it)?)\W*$/i
const NOTE_H = /^\W*(notes?|tips?)\W*$/i
const META = [
  ['servings', /^(?:serves|servings?|yields?|makes)\s*:?\s*(.+)$/i],
  ['prep_time', /^prep(?:aration)?(?: time)?\s*:?\s*(.+)$/i],
  ['cook_time', /^cook(?:ing)?(?: time)?\s*:?\s*(.+)$/i],
  ['total_time', /^total(?: time)?\s*:?\s*(.+)$/i],
]
export function recipeFromText(text) {
  const lines = (text || '').replace(/\r/g, '').split('\n').map((l) => l.trim())
  const r = { name: '', ingredients: [], directions: [], notes: [], description: [] }
  let section = null, sawHeader = false
  for (const l of lines) {
    if (!l) continue
    if (ING_H.test(l)) { section = 'ingredients'; sawHeader = true; continue }
    if (DIR_H.test(l)) { section = 'directions'; sawHeader = true; continue }
    if (NOTE_H.test(l)) { section = 'notes'; continue }
    const meta = META.find(([, re]) => re.test(l))
    if (meta && l.length < 60) { r[meta[0]] = l.match(meta[1])[1].trim(); continue }
    if (!r.name && !section) { r.name = l.replace(/^#+\s*/, '').slice(0, 120); continue }
    if (section) r[section].push(l.replace(/^[-•*▢☐]\s*/, ''))
    else r.description.push(l)
  }
  if (!sawHeader) {
    // No headings: short lines that start with a quantity are ingredients, the rest are steps.
    const body = r.description; r.description = []
    for (const l of body) {
      const clean = l.replace(/^[-•*▢☐]\s*/, '')
      if (parseIngredient(clean).qty != null && clean.length < 90 && !/^\d+[.)]\s/.test(l)) r.ingredients.push(clean)
      else r.directions.push(clean)
    }
  }
  return {
    name: r.name || 'Untitled recipe',
    ingredients: r.ingredients.join('\n'), directions: r.directions.join('\n\n'),
    notes: r.notes.join('\n'), description: r.description.join('\n'),
    servings: r.servings || '', prep_time: r.prep_time || '', cook_time: r.cook_time || '', total_time: r.total_time || '',
  }
}
