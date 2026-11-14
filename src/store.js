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
const bump = () => { state.version++; cache.clear(); listeners.forEach((l) => l()) }
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const uid = () => crypto.randomUUID().toUpperCase()
const now = () => new Date().toISOString()
let onDirty = () => {}
export const setDirtyHook = (fn) => { onDirty = fn }
function fail(e) { state.error = 'Could not save: ' + (e?.message || e); bump(); throw e }
export const clearError = () => { state.error = null; bump() }

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
  bump()
  try { await (await dbp).put('kv', value, key) } catch (e) { fail(e) }
}

/** Save one or many records. fromSync=true keeps server timestamps and does not mark dirty. */
export async function saveItems(list, { fromSync = false } = {}) {
  const db = await dbp
  const tx = db.transaction('items', 'readwrite')
  const saved = []
  for (const it of list) {
    const rec = fromSync ? { ...it, dirty: 0 } : { ...it, id: it.id || uid(), u: now(), dirty: 1 }
    state.items.set(rec.id, rec); tx.store.put(rec); saved.push(rec)
  }
  try { await tx.done } catch (e) { fail(e) }
  bump()
  if (!fromSync) onDirty()
  return saved
}
export const saveItem = async (it) => (await saveItems([it]))[0]
export const removeItem = (id) => { const it = state.items.get(id); return it ? saveItem({ ...it, deleted: true }) : null }
export const restoreItem = (id) => { const it = state.items.get(id); return it ? saveItem({ ...it, deleted: false }) : null }
export const dirtyItems = () => [...state.items.values()].filter((i) => i.dirty)
export async function markClean(ids, stamps = {}) {
  const db = await dbp; const tx = db.transaction('items', 'readwrite')
  for (const id of ids) { const it = state.items.get(id); if (!it) continue; const rec = { ...it, dirty: 0, u: stamps[id] || it.u }; state.items.set(id, rec); tx.store.put(rec) }
  await tx.done; bump()
}

// ---- photos (blobs kept out of memory; loaded on demand) ----
const urls = new Map()
export const photoId = (recipeId, idx = 0) => `${recipeId}:${idx}`
export async function putPhoto(recipeId, idx, blob, { synced = false } = {}) {
  const id = photoId(recipeId, idx)
  try { await (await dbp).put('photos', { id, recipeId, idx, blob, synced: synced ? 1 : 0, u: now() }) } catch (e) { fail(e) }
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id) }
  if (!synced) onDirty()
  return id
}
export async function getPhoto(id) { return (await dbp).get('photos', id) }
export async function photosOf(recipeId) { return (await (await dbp).getAllFromIndex('photos', 'recipeId', recipeId)).sort((a, b) => a.idx - b.idx) }
export async function deletePhoto(id) { await (await dbp).delete('photos', id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id) } }
export async function unsyncedPhotos() { return (await (await dbp).getAll('photos')).filter((p) => !p.synced) }
export async function allPhotoKeys() { return (await dbp).getAllKeys('photos') }
export async function markPhotoSynced(id) { const db = await dbp; const p = await db.get('photos', id); if (p) await db.put('photos', { ...p, synced: 1 }) }
export async function photoUrl(id) {
  if (urls.has(id)) return urls.get(id)
  const p = await getPhoto(id)
  if (!p) return null
  const u = URL.createObjectURL(p.blob); urls.set(id, u); return u
}
/** v = recipe.pv (photo version) so the hook refreshes when a photo changes or arrives by sync */
export function usePhoto(recipeId, idx = 0, v = 0) {
  const id = photoId(recipeId, idx)
  const [url, setUrl] = useState(urls.get(id) || null)
  useEffect(() => { let on = true; setUrl(urls.get(id) || null); photoUrl(id).then((u) => on && setUrl(u)); return () => { on = false } }, [id, v])
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
