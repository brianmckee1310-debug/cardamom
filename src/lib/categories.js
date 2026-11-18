// Categories can nest one or more levels deep. A subcategory is just a name with its parents
// in front of it — "Dinner > Pasta" — which keeps the stored shape a flat list of strings and
// means an existing library needs no migration.
export const SEP = ' > '
const clean = (s) => String(s || '').replace(/\s*>\s*/g, SEP).replace(/\s+/g, ' ').trim().replace(/^(>\s*)+|(\s*>)+$/g, '').trim()

export const parts = (c) => clean(c).split(SEP).filter(Boolean)
export const leaf = (c) => parts(c).slice(-1)[0] || ''
export const parent = (c) => { const p = parts(c); return p.length > 1 ? p.slice(0, -1).join(SEP) : '' }
export const depth = (c) => Math.max(parts(c).length - 1, 0)
export const join = (...xs) => xs.flatMap(parts).join(SEP)
export const normalizeCat = (c) => parts(c).join(SEP)
/** "Dinner" covers "Dinner > Pasta"; it does not cover "Dinner Rolls". */
export const isUnder = (cat, ancestor) => { const c = normalizeCat(cat), a = normalizeCat(ancestor); return !!a && (c === a || c.startsWith(a + SEP)) }
/** Every ancestor a name implies, so a child can exist without its parent being typed out. */
export const ancestors = (c) => parts(c).slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join(SEP))

/** Does this recipe belong under `cat`, counting anything filed in a subcategory? */
export const inCategory = (r, cat) => (r.categories || []).some((c) => isUnder(c, cat))

/**
 * Build the tree shown in the picker. `counts` is the flat [name, n] list the store already
 * produces; parents that only exist implicitly are created, and every node's count includes
 * its descendants, which is what you expect when you tap a parent.
 */
export function categoryTree(counts) {
  const own = new Map(counts.map(([c, n]) => [normalizeCat(c), n]))
  const all = new Set(own.keys())
  for (const c of [...all]) for (const a of ancestors(c)) all.add(a)
  const total = new Map()
  for (const c of all) {
    let n = own.get(c) || 0
    for (const other of all) if (other !== c && isUnder(other, c)) n += own.get(other) || 0
    total.set(c, n)
  }
  const nodes = [...all].sort((a, b) => a.localeCompare(b)).map((c) => ({ name: c, label: leaf(c), parent: parent(c), depth: depth(c), count: total.get(c), own: own.get(c) || 0, real: own.has(c) }))
  return nodes
}

/** The picker shows a node only when every ancestor above it is expanded. */
export const visibleNodes = (nodes, open) => nodes.filter((n) => ancestors(n.name).every((a) => open.has(a)))
export const hasChildren = (nodes, name) => nodes.some((n) => n.parent === name)

/**
 * Renaming or re-parenting a branch. Returns the full old -> new map, so children follow their
 * parent rather than being orphaned.
 */
export function renameMap(all, from, to) {
  const f = normalizeCat(from), t = normalizeCat(to)
  const map = new Map()
  if (!f || !t || f === t) return map
  if (isUnder(t, f)) return map // refuse to move a branch inside itself
  for (const c of all.map(normalizeCat)) if (isUnder(c, f)) map.set(c, t + c.slice(f.length))
  return map
}

/** Apply a rename map to one recipe's category list, dropping duplicates. */
export const applyRename = (cats, map) => [...new Set((cats || []).map((c) => map.get(normalizeCat(c)) || c))].sort((a, b) => a.localeCompare(b))
