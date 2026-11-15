import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKind, useThumb, prewarmPhoto, allCategories, useSettings, setSetting } from '../store.js'
import { useApp, Icon, IconBtn, Stars, Empty, Sheet } from './bits.jsx'

const SORTS = [['name', 'Name'], ['new', 'Newest'], ['rating', 'Rating'], ['time', 'Quickest']]
const mins = (s) => { if (!s) return 9e9; let t = 0; const h = s.match(/(\d+(?:\.\d+)?)\s*h/i), m = s.match(/(\d+)\s*m/i); if (h) t += parseFloat(h[1]) * 60; if (m) t += +m[1]; return t || 9e9 }
export function searchRecipes(list, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return list
  return list.filter((r) => { const hay = `${r.name}\n${r.ingredients}\n${r.source}\n${(r.categories || []).join(' ')}\n${r.notes}`.toLowerCase(); return words.every((w) => hay.includes(w)) })
}

export function Thumb({ recipe, size = 62 }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setSeen(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(ref.current)
    const f = (e) => e.detail === recipe.id && setBump((b) => b + 1)
    addEventListener('cardamom-photo', f)
    return () => { io.disconnect(); removeEventListener('cardamom-photo', f) }
  }, [recipe.id])
  return <div ref={ref} className="thumb" style={{ width: size, height: size }}>{seen && recipe.photos?.length ? <ThumbImg id={recipe.id} v={(recipe.pv || 0) + bump} /> : <span className="thumb-ph">{(recipe.name || '?').trim()[0]}</span>}</div>
}
function ThumbImg({ id, v }) { const url = useThumb(id, 0, v); return url ? <img src={url} alt="" loading="lazy" decoding="async" /> : null }

/** One library row. Memoised: opening an overlay must not re-render a 400-row list. */
export const RecipeRow = memo(function RecipeRow({ recipe, onClick, right }) {
  return (
    <li className="row recipe-row">
      <button className="row-main" onClick={() => onClick(recipe)}>
        <Thumb recipe={recipe} />
        <span className="row-text">
          <b>{recipe.name}</b>
          <small>{[recipe.source, recipe.total_time || recipe.cook_time].filter(Boolean).join(' \u00b7 ')}</small>
          <span className="row-meta">{recipe.rating > 0 && <Stars value={recipe.rating} size={12} />}{recipe.favorite && <Icon name="heart" size={13} fill="currentColor" className="ico fav" />}</span>
        </span>
      </button>
      {right}
    </li>
  )
})

export default function Recipes() {
  const { push } = useApp()
  const recipes = useKind('recipe')
  // Start the hero photo read on the tap, so it overlaps the page animation instead of
  // following it.
  const open = useCallback((r) => { prewarmPhoto(r.id); push('recipe', { id: r.id }) }, [push])
  const settings = useSettings()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [picking, setPicking] = useState(false)
  const [limit, setLimit] = useState(60)
  const sort = settings.sort || 'name'
  const shown = useMemo(() => {
    let list = recipes
    if (cat === 'fav') list = list.filter((r) => r.favorite)
    else if (cat === 'none') list = list.filter((r) => !(r.categories || []).length)
    else if (cat !== 'all') list = list.filter((r) => (r.categories || []).includes(cat))
    list = searchRecipes(list, q)
    const by = { name: (a, b) => a.name.localeCompare(b.name), new: (a, b) => (b.created || '').localeCompare(a.created || ''), rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name), time: (a, b) => mins(a.total_time || a.cook_time) - mins(b.total_time || b.cook_time) }
    return [...list].sort(by[sort])
  }, [recipes, q, cat, sort])
  useEffect(() => setLimit(60), [q, cat, sort])
  const more = useRef(null)
  useEffect(() => { if (!more.current) return; const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + 80), { rootMargin: '600px' }); io.observe(more.current); return () => io.disconnect() }, [shown.length > limit])
  const title = cat === 'all' ? 'Recipes' : cat === 'fav' ? 'Favorites' : cat === 'none' ? 'Uncategorized' : cat
  return (
    <>
      <header className="top">
        <button className="top-title" onClick={() => setPicking(true)} aria-label="Choose category"><h1>{title}</h1><small>{shown.length}</small><Icon name="chevron" size={16} className="ico down" /></button>
        <IconBtn icon="sort" label={`Sort: ${SORTS.find((s) => s[0] === sort)[1]}`} onClick={() => setSetting('sort', SORTS[(SORTS.findIndex((s) => s[0] === sort) + 1) % SORTS.length][0])} />
        <IconBtn icon="plus" label="Add recipe" className="accent" onClick={() => push('import')} />
      </header>
      <div className="search"><Icon name="search" size={18} /><input type="search" placeholder="Search name, ingredient, source" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />{sort !== 'name' && <span className="pill">{SORTS.find((s) => s[0] === sort)[1]}</span>}</div>
      {recipes.length === 0 ? (
        <Empty icon="book" title="No recipes yet">
          {settings.household
            ? 'Recipes added on another phone in your household will turn up here on their own. You can also bring a Paprika library over, or write one yourself.'
            : 'Three ways in: join the household to share the recipes already there, bring a Paprika library over, or write one yourself.'}
          <span className="empty-actions">
            {!settings.household && <button className="btn primary" onClick={() => push('household')}>Join a household</button>}
            <button className={`btn ${settings.household ? 'primary' : ''}`} onClick={() => push('import', { mode: 'paprika' })}>Import from Paprika</button>
            <button className="btn" onClick={() => push('import')}>Add a recipe by hand</button>
          </span>
        </Empty>
      ) : shown.length === 0 ? <Empty icon="search" title="Nothing matches">Try fewer words or another category.</Empty> : (
        <ul className="list">
          {shown.slice(0, limit).map((r) => <RecipeRow key={r.id} recipe={r} onClick={open} />)}
          {shown.length > limit && <li ref={more} className="row more-row">Loading more</li>}
        </ul>
      )}
      {picking && (
        <Sheet title="Categories" onClose={() => setPicking(false)} tall>
          <ul className="list plain">
            {[['all', 'All recipes', recipes.length], ['fav', 'Favorites', recipes.filter((r) => r.favorite).length], ['none', 'Uncategorized', recipes.filter((r) => !(r.categories || []).length).length], ...allCategories().map(([c, n]) => [c, c, n])].map(([id, label, n]) => (
              <li key={id} className="row"><button className={`row-main ${cat === id ? 'sel' : ''}`} onClick={() => { setCat(id); setPicking(false) }}><span className="row-text"><b>{label}</b></span><small className="count">{n}</small></button></li>
            ))}
          </ul>
          <button className="btn block" onClick={() => { setPicking(false); push('categories') }}>Manage categories</button>
        </Sheet>
      )}
    </>
  )
}
