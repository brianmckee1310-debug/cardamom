import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getItem, saveItem, allCategories, photosOf, putPhoto, deletePhoto, shrinkImage, uid } from '../store.js'
import { useApp, Page, Icon, IconBtn, Stars, Field, AutoText, Busy } from './bits.jsx'
import { suggestCategories, suggestCategoriesLocal, analyseNutrition } from '../lib/gemini.js'
import { notablesForRecipe, mergeNotables } from '../lib/notables.js'
import { aiCfg, hasAi, fetchImage } from '../lib/importers.js'

const BLANK = { name: '', description: '', ingredients: '', directions: '', notes: '', nutritional_info: '', prep_time: '', cook_time: '', total_time: '', difficulty: '', servings: '', source: '', source_url: '', image_url: '', rating: 0, favorite: false, categories: [], photos: [] }

export default function RecipeEdit({ id, draft, via, photoBlobs }) {
  const app = useApp()
  const existing = id ? getItem(id) : null
  const [r, setR] = useState(() => ({ ...BLANK, ...(existing || draft || {}) }))
  const [photos, setPhotos] = useState([]) // {idx, url, blob?}
  const [gone, setGone] = useState([])
  const [newCat, setNewCat] = useState('')
  const [aiCats, setAiCats] = useState(null)
  const [busy, setBusy] = useState('')
  const fileRef = useRef(null)
  const all = useMemo(() => allCategories().map((c) => c[0]), [])
  const up = (k) => (v) => setR((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const made = useRef([])
  const addBlob = async (blob, first) => {
    const small = await shrinkImage(blob, 1600)
    const url = URL.createObjectURL(small); made.current.push(url)
    setPhotos((ps) => { const idx = !ps.some((p) => p.idx === 0) ? 0 : Math.max(0, ...ps.map((p) => p.idx), ...gone) + 1; return [...ps, { idx, url, blob: small }].sort((a, b) => a.idx - b.idx) })
  }
  useEffect(() => {
    let on = true
    if (existing) photosOf(existing.id).then((ps) => { if (!on) return; setPhotos(ps.map((p) => { const url = URL.createObjectURL(p.blob); made.current.push(url); return { idx: p.idx, url } })) })
    else if (photoBlobs?.length) photoBlobs.forEach((b, i) => addBlob(b, i === 0))
    else if (draft?.image_url) fetchImage(draft.image_url).then((b) => on && b && addBlob(b, true))
    return () => { on = false; made.current.forEach((u) => URL.revokeObjectURL(u)) }
  }, [])
  const local = useMemo(() => {
    const fromSite = (draft?.suggested || []).map((s) => all.find((c) => c.toLowerCase().trim() === s.toLowerCase())).filter(Boolean)
    return [...new Set([...fromSite, ...suggestCategoriesLocal(r, all)])].filter((c) => !r.categories.includes(c))
  }, [r.name, r.ingredients, r.categories, all])
  const suggestions = [...new Set([...(aiCats || []), ...local])].filter((c) => !r.categories.includes(c)).slice(0, 8)
  const toggleCat = (c) => setR((x) => ({ ...x, categories: x.categories.includes(c) ? x.categories.filter((y) => y !== c) : [...x.categories, c].sort((a, b) => a.localeCompare(b)) }))
  const askAi = async () => { setBusy('Thinking about categories'); try { const s = await suggestCategories(aiCfg(), r, all); setAiCats(s); if (!s.length) app.toast('No further suggestions') } catch (e) { app.toast(e.message) } setBusy('') }
  const nutrition = async () => {
    setBusy('Analysing nutrition')
    try {
      const { values, text, notables } = await analyseNutrition(aiCfg(), r)
      setR((x) => ({ ...x, nutritional_info: text, nut: values, notables: mergeNotables(notablesForRecipe(x), notables) }))
    } catch (e) { app.toast(e.message) }
    setBusy('')
  }

  const save = async () => {
    if (!r.name.trim()) { app.toast('Give the recipe a name first'); return }
    const rid = existing?.id || uid()
    const changed = gone.length > 0 || photos.some((p) => p.blob)
    for (const idx of gone) await deletePhoto(`${rid}:${idx}`)
    for (const p of photos) if (p.blob) await putPhoto(rid, p.idx, p.blob)
    const { suggested, ...clean } = r
    await saveItem({ ...clean, id: rid, kind: 'recipe', name: r.name.trim(), created: r.created || new Date().toISOString().slice(0, 19).replace('T', ' '), photos: photos.map((p) => p.idx), pv: (r.pv || 0) + (changed ? 1 : 0) })
    if (changed) dispatchEvent(new CustomEvent('cardamom-photo', { detail: rid }))
    app.toast(existing ? 'Saved' : 'Recipe added')
    if (existing) app.back(); else app.replace('recipe', { id: rid })
  }

  return (
    <Page className="edit" title={existing ? 'Edit recipe' : 'New recipe'} onBack={app.back} actions={<button className="btn primary small" onClick={save}>Save</button>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save() }}>
        {via && <p className="banner"><Icon name="sparkle" size={16} />{via}. Check it over before saving.</p>}
        {busy && <Busy label={busy} />}
        <Field label="Name"><input value={r.name} onChange={up('name')} placeholder="Recipe name" autoFocus={!existing && !draft} /></Field>
        <div className="photo-strip">
          {photos.map((p) => <div className="photo-tile" key={p.idx}><img src={p.url} alt="" /><IconBtn icon="close" label="Remove photo" onClick={() => { setPhotos((ps) => ps.filter((x) => x.idx !== p.idx)); if (!p.blob) setGone((g) => [...g, p.idx]) }} />{p.idx === 0 && <span className="pill">Main</span>}</div>)}
          <button type="button" className="photo-add" onClick={() => fileRef.current.click()}><Icon name="camera" /><span>Add photo</span></button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { [...e.target.files].forEach((f, i) => addBlob(f, i === 0)); e.target.value = '' }} />
        </div>
        <Field label="Rating"><Stars value={r.rating} onChange={up('rating')} size={26} /></Field>
        <div className="field">
          <span className="field-label">Categories</span>
          <div className="chips">{r.categories.map((c) => <button type="button" className="chip on" key={c} onClick={() => toggleCat(c)}>{c}<Icon name="close" size={12} /></button>)}{!r.categories.length && <span className="muted">None yet</span>}</div>
          {suggestions.length > 0 && <div className="suggest"><span className="field-hint"><Icon name="sparkle" size={13} />Suggested</span><div className="chips">{suggestions.map((c) => <button type="button" className="chip ghost" key={c} onClick={() => toggleCat(c)}><Icon name="plus" size={12} />{c}</button>)}</div></div>}
          <div className="rowline">
            <select value="" onChange={(e) => e.target.value && toggleCat(e.target.value)} aria-label="Add existing category"><option value="">Add category</option>{all.filter((c) => !r.categories.includes(c)).map((c) => <option key={c}>{c}</option>)}</select>
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" aria-label="New category" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newCat.trim()) { toggleCat(newCat.trim()); setNewCat('') } } }} />
            {newCat.trim() && <button type="button" className="btn small" onClick={() => { toggleCat(newCat.trim()); setNewCat('') }}>Add</button>}
            {hasAi() && <button type="button" className="btn small" onClick={askAi}><Icon name="sparkle" size={15} />AI</button>}
          </div>
        </div>
        <div className="grid2">
          <Field label="Prep time"><input value={r.prep_time} onChange={up('prep_time')} /></Field>
          <Field label="Cook time"><input value={r.cook_time} onChange={up('cook_time')} /></Field>
          <Field label="Total time"><input value={r.total_time} onChange={up('total_time')} /></Field>
          <Field label="Servings"><input value={r.servings} onChange={up('servings')} /></Field>
        </div>
        <Field label="Ingredients" hint="One per line. End a line with a colon to make a heading."><AutoText value={r.ingredients} onChange={up('ingredients')} rows={6} /></Field>
        <Field label="Directions" hint="One step per line."><AutoText value={r.directions} onChange={up('directions')} rows={6} /></Field>
        <Field label="Description"><AutoText value={r.description} onChange={up('description')} rows={2} /></Field>
        <Field label="Notes"><AutoText value={r.notes} onChange={up('notes')} rows={2} /></Field>
        <div className="field"><span className="field-label">Nutrition{hasAi() && <button type="button" className="btn small right" onClick={nutrition}><Icon name="chart" size={15} />Analyse</button>}</span><AutoText value={r.nutritional_info} onChange={up('nutritional_info')} rows={2} aria-label="Nutrition" /></div>
        <div className="grid2">
          <Field label="Source"><input value={r.source} onChange={up('source')} /></Field>
          <Field label="Difficulty"><input value={r.difficulty} onChange={up('difficulty')} /></Field>
        </div>
        <Field label="Source link"><input value={r.source_url} onChange={up('source_url')} inputMode="url" /></Field>
        <button type="submit" className="btn primary block">Save</button>
      </form>
    </Page>
  )
}
