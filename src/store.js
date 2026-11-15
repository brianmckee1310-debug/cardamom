// Local-first storage: everything lives in IndexedDB; sync (if configured) pushes "dirty" records.
import { openDB } from 'idb'
import { useSyncExternalStore, useEffect, useState } from 'react'

const dbp = openDB('cardamom', 1, {
  upgrade(db) {
    const items = db.createObjectStore('items', { keyPath: 'id' })
    items.createIndex('kind', 'kind')
    const photos = db.createObjectStore('photos', { keyPath: 'id' })
    photos.createIndex('recipeId', 'recipeId')
    db.createObjectStore('kv')
  },
})

const state = { items: new Map(), settings: {}, ready: false, version: 0, error: null }
const listeners = new Set()
const cache = new Map()
/**
 * Derived lists are cached per kind. A save only invalidates the kinds it touched, so saving
 * one grocery item no longer makes a 473-recipe list rebuild and re-sort itself.
 * Pass no argument to drop everything (wipe, import).
 */
const bump = (kinds) => {
  state.version++
  if (!kinds) cache.clear()
  else { for (const k of kinds) cache.delete(k); if (kinds.has('recipe')) cache.delete('#cats') }
  listeners.forEach((l) => l())
}
const kindsOf = (list) => new Set(list.map((i) => i && i.kind).filter(Boolean))
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const uid = () => crypto.randomUUID().toUpperCase()
const now = () => new Date().toISOString()
let onDirty = () => {}
export const setDirtyHook = (fn) => { onDirty = fn }

/** Storage errors are the one failure a person actually meets, so say what to do about it. */
function saveError(e) {
  const name = e?.name || ''
  if (name === 'QuotaExceededError' || /quota|storage/i.test(e?.message || '')) {
    return 'There is no room left on this device to save that. Deleting some recipe photos, or clearing space on the phone, will fix it.'
  }
  if (name === 'InvalidStateError' || /closing|closed/i.test(e?.message || '')) {
    return 'Could not save — the app lost its connection to the phone’s storage. Closing and reopening Cardamom should fix it.'
  }
  return 'Could not save that change. Nothing was lost; try again.' + (e?.message ? ` (${e.message})` : '')
}
function fail(e) { state.error = saveError(e); bump(); throw e }
export const clearError = () => { state.error = null; bump(new Set()) }

export async function loadAll() {
  const db = await dbp
  const [items, keys, vals] = await Promise.all([db.getAll('items'), db.getAllKeys('kv'), db.getAll('kv')])
  state.items = new Map(items.map((i) => [i.id, i]))
  state.settings = Object.fromEntries(keys.map((k, i) => [k, vals[i]]))
  state.ready = true
  bump()
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
}

export function useStore() { useSyncExternalStore(subscribe, () => state.version); return state }
export function listKind(kind) {
  if (!cache.has(kind)) cache.set(kind, [...state.items.values()].filter((i) => i.kind === kind && !i.deleted))
  return cache.get(kind)
}
export function useKind(kind) { useSyncExternalStore(subscribe, () => state.version); return listKind(kind) }
export function useItem(id) { useSyncExternalStore(subscribe, () => state.version); const i = state.items.get(id); return i && !i.deleted ? i : null }
export const getItem = (id) => state.items.get(id)
export function useSettings() { useSyncExternalStore(subscribe, () => state.version); return state.settings }
export const getSettings = () => state.settings

export async function setSetting(key, value) {
  state.settings = { ...state.settings, [key]: value }
  bump(new Set())
  try { await (await dbp).put('kv', value, key) } catch (e) { fail(e) }
}

/** Save one or many records. fromSync=true keeps server timestamps and does not mark dirty. */
export async function saveItems(list, { fromSync = false } = {}) {
  const db = await dbp
  const tx = db.transaction('items', 'readwrite')
  const saved = []
  for (const it of list) {
    const rec = fromSync ? { ...it, dirty: 0 } : { ...it, id: it.id || uid(), u: now(), dirty: 1 }
    const was = state.items.get(rec.id)
    if (was && was.kind !== rec.kind) cache.delete(was.kind)
    state.items.set(rec.id, rec); tx.store.put(rec); saved.push(rec)
  }
  try { await tx.done } catch (e) { fail(e) }
  bump(kindsOf(saved))
  if (!fromSync) onDirty()
  return saved
}
export const saveItem = async (it) => (await saveItems([it]))[0]
export const removeItem = (id) => { const it = state.items.get(id); return it ? saveItem({ ...it, deleted: true }) : null }
export const restoreItem = (id) => { const it = state.items.get(id); return it ? saveItem({ ...it, deleted: false }) : null }
export const dirtyItems = () => [...state.items.values()].filter((i) => i.dirty)
export async function markClean(ids, stamps = {}) {
  const db = await dbp; const tx = db.transaction('items', 'readwrite')
  const touched = []
  for (const id of ids) { const it = state.items.get(id); if (!it) continue; const rec = { ...it, dirty: 0, u: stamps[id] || it.u }; state.items.set(id, rec); tx.store.put(rec); touched.push(rec) }
  await tx.done; bump(kindsOf(touched))
}

// ---- photos (blobs kept out of memory; loaded on demand) ----
//
// Two sizes matter. The hero on a recipe page wants the full photo; a 62px row thumbnail does
// not, and decoding a 1600px JPEG into it — once per visible row — is what made browsing a
// large library and then opening a recipe feel heavy. So a small thumbnail is made once and
// stored beside the photo, and full-size object URLs are capped so a long scroll cannot pin
// hundreds of decoded bitmaps in memory.
const urls = new Map()      // full size, LRU-capped
const thumbs = new Map()    // small, cheap to keep around
const FULL_CAP = 12
const THUMB_MAX = 240
const inflight = new Map()

function keepFull(id, url) {
  urls.set(id, url)
  while (urls.size > FULL_CAP) {
    const oldest = urls.keys().next().value
    if (oldest === id) break
    URL.revokeObjectURL(urls.get(oldest)); urls.delete(oldest)
  }
}
const touchFull = (id) => { if (!urls.has(id)) return null; const u = urls.get(id); urls.delete(id); urls.set(id, u); return u }
const dropUrl = (id) => {
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id) }
  if (thumbs.has(id)) { URL.revokeObjectURL(thumbs.get(id)); thumbs.delete(id) }
  inflight.delete(id); fullInflight.delete(id)
}

export const photoId = (recipeId, idx = 0) => `${recipeId}:${idx}`
export async function putPhoto(recipeId, idx, blob, { synced = false } = {}) {
  const id = photoId(recipeId, idx)
  try { await (await dbp).put('photos', { id, recipeId, idx, blob, synced: synced ? 1 : 0, u: now() }) } catch (e) { fail(e) }
  dropUrl(id)
  if (!synced) onDirty()
  return id
}
export async function getPhoto(id) { return (await dbp).get('photos', id) }
export async function photosOf(recipeId) { return (await (await dbp).getAllFromIndex('photos', 'recipeId', recipeId)).sort((a, b) => a.idx - b.idx) }
export async function deletePhoto(id) { await (await dbp).delete('photos', id); dropUrl(id) }
export async function unsyncedPhotos() { return (await (await dbp).getAll('photos')).filter((p) => !p.synced) }
export async function allPhotoKeys() { return (await dbp).getAllKeys('photos') }
export async function markPhotoSynced(id) { const db = await dbp; const p = await db.get('photos', id); if (p) await db.put('photos', { ...p, synced: 1 }) }

const fullInflight = new Map()
export async function photoUrl(id) {
  const warm = touchFull(id)
  if (warm) return warm
  if (fullInflight.has(id)) return fullInflight.get(id)
  const job = (async () => {
    holdOff++
    try {
      const p = await getPhoto(id)
      if (!p) return null
      const again = touchFull(id)
      if (again) return again
      const u = URL.createObjectURL(p.blob); keepFull(id, u); return u
    } finally { holdOff--; pump() }
  })()
  fullInflight.set(id, job)
  try { return await job } finally { fullInflight.delete(id) }
}
/** Start the full-size read early (on tap) so it overlaps the page animation. */
export const prewarmPhoto = (recipeId, idx = 0) => { photoUrl(photoId(recipeId, idx)).catch(() => {}) }

async function makeThumb(blob) {
  try {
    const bmp = await createImageBitmap(blob)
    const s = Math.min(1, THUMB_MAX / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s))
    let c
    if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h)
    else { c = document.createElement('canvas'); c.width = w; c.height = h }
    c.getContext('2d').drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    return c.convertToBlob ? await c.convertToBlob({ type: 'image/jpeg', quality: 0.78 }) : await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.78))
  } catch { return null }
}

// A library imported before thumbnails existed has to grow them once, and a fast scroll can
// ask for three hundred at a time. Left unchecked that backfill saturates IndexedDB and the
// next recipe you open waits behind it. So: two at a time, newest request first (those are
// the rows you actually stopped on), paused outright while a full-size photo is being read,
// and the write-back batched.
let running = 0
let holdOff = 0
const waiting = []
const writeBack = []
let writeTimer = null

function pump() {
  while (running < 2 && !holdOff && waiting.length) {
    const job = waiting.pop() // newest first
    running++
    job().catch(() => {}).finally(() => { running--; pump() })
  }
}
function flushThumbWrites() {
  writeTimer = null
  const batch = writeBack.splice(0)
  if (!batch.length) return
  dbp.then(async (db) => {
    const tx = db.transaction('photos', 'readwrite')
    for (const rec of batch) tx.store.put(rec)
    await tx.done
  }).catch(() => {})
}
const queueThumbWrite = (rec) => {
  writeBack.push(rec)
  if (writeBack.length >= 24) { clearTimeout(writeTimer); flushThumbWrites() }
  else if (!writeTimer) writeTimer = setTimeout(flushThumbWrites, 500)
}

/** Thumbnail for a list row. Made once from the full photo and kept beside it in IndexedDB. */
export function thumbUrl(id) {
  if (thumbs.has(id)) return Promise.resolve(thumbs.get(id))
  if (inflight.has(id)) return inflight.get(id)
  let settle
  const promise = new Promise((res) => { settle = res })
  inflight.set(id, promise)
  waiting.push(async () => {
    try {
      if (thumbs.has(id)) return settle(thumbs.get(id))
      const p = await getPhoto(id)
      if (!p) return settle(null)
      let small = p.thumb
      if (!small) { small = await makeThumb(p.blob); if (small) queueThumbWrite({ ...p, thumb: small }) }
      const u = URL.createObjectURL(small || p.blob)
      thumbs.set(id, u)
      settle(u)
    } catch { settle(null) } finally { inflight.delete(id) }
  })
  pump()
  return promise
}

/** v = recipe.pv (photo version) so the hook refreshes when a photo changes or arrives by sync */
export function usePhoto(recipeId, idx = 0, v = 0) {
  const id = photoId(recipeId, idx)
  const [url, setUrl] = useState(() => touchFull(id) || null)
  useEffect(() => { let on = true; setUrl(touchFull(id) || null); photoUrl(id).then((u) => on && setUrl(u)); return () => { on = false } }, [id, v])
  return url
}
export function useThumb(recipeId, idx = 0, v = 0) {
  const id = photoId(recipeId, idx)
  const [url, setUrl] = useState(() => thumbs.get(id) || null)
  useEffect(() => { let on = true; setUrl(thumbs.get(id) || null); thumbUrl(id).then((u) => on && setUrl(u)); return () => { on = false } }, [id, v])
  return url
}

export async function shrinkImage(blob, max = 1600, quality = 0.84) {
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (scale === 1 && blob.size < 600000 && /jpe?g/.test(blob.type)) return blob
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((res) => c.toBlob((b) => res(b || blob), 'image/jpeg', quality))
  } catch { return blob }
}

export async function wipeAll() {
  const db = await dbp
  await Promise.all([db.clear('items'), db.clear('photos')])
  for (const k of ['cursor']) await db.delete('kv', k)
  for (const id of [...urls.keys(), ...thumbs.keys()]) dropUrl(id)
  state.items = new Map(); delete state.settings.cursor; bump()
}

export function allCategories() {
  if (!cache.has('#cats')) {
    const counts = new Map()
    for (const r of listKind('recipe')) for (const c of r.categories || []) counts.set(c, (counts.get(c) || 0) + 1)
    for (const c of state.settings.extraCategories || []) if (!counts.has(c)) counts.set(c, 0)
    cache.set('#cats', [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  }
  return cache.get('#cats')
}
