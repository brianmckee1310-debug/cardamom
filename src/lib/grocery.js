// Grocery-list arithmetic, kept pure so it can be tested without a browser:
// matching item names, combining duplicates, and ranking recipes against the pantry.
import { parseIngredient, formatNumber, splitLines, isHeader, groceryFromLine, guessAisle } from './ingredients.js'

const FILLER = /\b(fresh|freshly|large|small|medium|chopped|diced|minced|sliced|grated|shredded|ground|dried|boneless|skinless|whole|raw|ripe|of|finely|roughly|thinly|peeled|cooked|unsalted|salted|extra|virgin|organic)\b/g
/** "2 Fresh Yellow Onions" and "yellow onion" are the same thing on a shopping list. */
const singular = (w) => (/(ches|shes|xes|oes|sses)$/.test(w) ? w.slice(0, -2) : /(ss|us|is)$/.test(w) || w.length < 4 ? w : w.replace(/s$/, ''))
export const normName = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z ]/g, ' ').replace(FILLER, ' ').split(/\s+/).filter(Boolean).map(singular).join(' ')
export const sameItem = (a, b) => { const x = normName(a), y = normName(b); return !!x && x === y }
/** Looser match, for "do we have this at home": garlic matches garlic cloves. */
export const looseMatch = (a, b) => { const x = normName(a), y = normName(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)) }

const NUM = /^[\d\s./½¼¾⅓⅔⅛⅜⅝⅞-]+/
/** "1 cup" + "2 cups" -> "3 cups"; anything it cannot add honestly is written "a + b". */
export function mergeQty(a, b) {
  a = String(a || '').trim(); b = String(b || '').trim()
  if (!a || !b) return a || b
  const pa = parseIngredient(a + ' x'), pb = parseIngredient(b + ' x')
  const unitOf = (t) => t.replace(NUM, '').trim().toLowerCase().replace(/\.$/, '').replace(/(es|s)$/, '')
  if (pa.qty != null && pb.qty != null && pa.qty2 == null && pb.qty2 == null && (pa.unit || '') === (pb.unit || '') && unitOf(a) === unitOf(b)) {
    const sum = pa.qty + pb.qty
    let unit = a.replace(NUM, '').trim() || b.replace(NUM, '').trim()
    if (unit && sum > 1 && pa.qty <= 1 && /^(cup|pound|ounce|clove|can|slice|bunch|stalk|sprig|head|teaspoon|tablespoon|piece|jar|bag|package)$/i.test(unit)) unit += /ch$/.test(unit) ? 'es' : 's'
    return `${formatNumber(sum)}${unit ? ' ' + unit : ''}`
  }
  return `${a} + ${b}`
}

const joinRecipes = (a, b) => [...new Set([...(a ? String(a).split(', ') : []), ...(b ? String(b).split(', ') : [])])].join(', ')

/**
 * Fold new items into a list. Anything matching an item still to buy on the same list is
 * combined with it rather than added again. Returns the records to save (changed + new).
 */
export function mergeIntoList(existing, incoming) {
  const open = existing.filter((e) => !e.done && !e.deleted)
  const touched = new Map()
  const fresh = []
  for (const inc of incoming) {
    const same = (e) => (e.list || '') === (inc.list || '') && sameItem(e.name, inc.name)
    const hit = fresh.find(same) || [...touched.values()].find(same) || open.find(same)
    if (!hit) { fresh.push({ ...inc }); continue }
    // Unsure about garlic for one recipe means unsure about garlic: a flag on any copy arriving
    // together flags the combined line. Something already on the saved list keeps its own state.
    const merged = { ...hit, qty: mergeQty(hit.qty, inc.qty), recipe: joinRecipes(hit.recipe, inc.recipe), check: hit.id ? !!hit.check : !!hit.check || !!inc.check }
    if (hit.id) touched.set(hit.id, merged); else fresh[fresh.indexOf(hit)] = merged
  }
  return [...touched.values(), ...fresh]
}

/** Pantry records to save so that `names` are in stock, without creating duplicates. */
export function pantryUpserts(pantry, items, day) {
  const out = []
  for (const it of items) {
    const hit = pantry.find((p) => sameItem(p.name, it.name)) || out.find((p) => sameItem(p.name, it.name))
    // Buying it again makes today the day you got it, so the age starts over.
    if (hit) { if (hit.inStock === false || hit.seen !== day) { const rec = { ...hit, inStock: true, seen: day, added: hit.inStock === false || !hit.added ? day : hit.added }; const at = out.indexOf(hit); if (at >= 0) out[at] = rec; else out.push(rec) } }
    else out.push({ kind: 'pantry', name: it.name, qty: '', aisle: it.aisle, inStock: true, seen: day, added: day })
  }
  return out
}

const ALWAYS = /^(water|salt|pepper|black pepper|kosher salt|sea salt|salt and pepper|ice|cooking spray)$/
/**
 * Recipes ranked by how much of them is already in the house. Water, salt and pepper are
 * assumed. Only recipes at least half covered are returned, best first.
 */
export function cookable(recipes, pantry, limit = 60) {
  const have = pantry.filter((p) => p.inStock !== false).map((p) => normName(p.name)).filter(Boolean)
  if (!have.length) return []
  const out = []
  for (const r of recipes) {
    const names = splitLines(r.ingredients).filter((l) => !isHeader(l)).map((l) => groceryFromLine(l).name)
    const need = [...new Set(names.map(normName).filter((n) => n && !ALWAYS.test(n)))]
    if (need.length < 2) continue
    const missing = need.filter((n) => !have.some((h) => n === h || n.includes(h) || h.includes(n)))
    const got = need.length - missing.length
    if (got / need.length >= 0.5) out.push({ recipe: r, total: need.length, got, missing })
  }
  return out.sort((a, b) => a.missing.length - b.missing.length || b.got / b.total - a.got / a.total || a.recipe.name.localeCompare(b.recipe.name)).slice(0, limit)
}

/** A typed or spoken line turned into a list item: "2 lb carrots" -> qty and name, with an aisle. */
export const quickItem = (text, kind, aisles) => {
  const g = parseIngredient(text).qty != null ? groceryFromLine(text) : { qty: '', name: String(text || '').trim() }
  return { kind, name: g.name, qty: g.qty, aisle: guessAisle(g.name, aisles) }
}
