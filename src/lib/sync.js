// Household sync through Supabase. One generic table (cardamom_items) + a storage bucket for photos.
import { createClient } from '@supabase/supabase-js'
import { getSettings, setSetting, dirtyItems, markClean, saveItems, listKind, unsyncedPhotos, markPhotoSynced, allPhotoKeys, putPhoto, getItem, setDirtyHook, deletePhoto } from '../store.js'
import { adoptMine } from './log.js'

export const BUILT_IN = { url: import.meta.env?.VITE_SB_URL || '', key: import.meta.env?.VITE_SB_KEY || '' }
export const sbConfig = () => { const s = getSettings(); return { url: s.sbUrl || BUILT_IN.url, key: s.sbKey || BUILT_IN.key } }
export const BUCKET = 'cardamom-photos'
let client = null, clientFor = ''
export function sb() {
  const { url, key } = sbConfig()
  if (!url || !key) return null
  if (clientFor !== url + key) { client = createClient(url, key, { auth: { storageKey: 'cardamom-auth' } }); clientFor = url + key }
  return client
}
export const functionsUrl = (name) => `${sbConfig().url}/functions/v1/${name}`

const status = { state: 'off', message: '', last: null, photosLeft: 0 }
const subs = new Set()
const set = (patch) => { Object.assign(status, patch); subs.forEach((f) => f({ ...status })) }
export const syncStatus = () => ({ ...status })
export const onSyncStatus = (f) => { subs.add(f); return () => subs.delete(f) }

export async function session() { const c = sb(); if (!c) return null; return (await c.auth.getSession()).data.session }
export async function signIn(email, password) { const { error } = await sb().auth.signInWithPassword({ email, password }); if (error) throw error; await rememberMe(); await findHousehold() }
// The confirmation email builds its link from the project's Site URL, which defaults to
// localhost:3000 — a dead end on a phone. Say where we actually live, so the link comes back
// here. The address has to be on the project's Redirect URLs allow-list to be honoured.
export const siteUrl = () => `${location.origin}${location.pathname}`
export async function signUp(email, password) { const { data, error } = await sb().auth.signUp({ email, password, options: { emailRedirectTo: siteUrl() } }); if (error) throw error; if (data.session) await rememberMe(); return !!data.session }

/**
 * The food log is per person, so the device needs to know who is using it. Anything logged
 * before signing in is claimed by whoever signs in here first, rather than being orphaned.
 */
export async function rememberMe() {
  const uid = (await session())?.user?.id
  if (!uid || getSettings().meId === uid) return
  await setSetting('meId', uid)
  await adoptMine(uid)
}
export async function signOut() { await sb()?.auth.signOut(); await setSetting('household', null); set({ state: 'off', message: '' }) }

export async function findHousehold() {
  const { data, error } = await sb().from('cardamom_members').select('household_id, cardamom_households(name, join_code, feed_token)').limit(1)
  if (error) throw error
  const row = data?.[0]
  const h = row ? { id: row.household_id, ...row.cardamom_households } : null
  await setSetting('household', h)
  return h
}
export async function createHousehold(name) { const { error } = await sb().rpc('cardamom_create_household', { p_name: name }); if (error) throw error; return findHousehold() }
export async function joinHousehold(code) { const { error } = await sb().rpc('cardamom_join_household', { p_code: code.trim().toUpperCase() }); if (error) throw error; await setSetting('cursor', null); return findHousehold() }

const strip = ({ dirty, u, ...data }) => data
let running = null, again = false
export function syncNow() {
  if (running) { again = true; return running }
  running = run().finally(() => { running = null; if (again) { again = false; syncNow() } })
  return running
}
async function run() {
  const c = sb(); const h = getSettings().household
  if (!c || !h) return
  if (!(await session())) { set({ state: 'off', message: 'Signed out' }); return }
  set({ state: 'syncing', message: '' })
  try {
    // 1. push
    const dirty = dirtyItems()
    for (let i = 0; i < dirty.length; i += 100) {
      const rows = dirty.slice(i, i + 100).map((it) => ({ household_id: h.id, id: it.id, kind: it.kind, data: strip(it), deleted: !!it.deleted }))
      const { data, error } = await c.from('cardamom_items').upsert(rows).select('id, updated_at')
      if (error) throw error
      // only mark clean if the record was not edited again while uploading
      const ok = data.filter((r) => getItem(r.id)?.u === dirty.find((d) => d.id === r.id).u)
      await markClean(ok.map((r) => r.id), Object.fromEntries(ok.map((r) => [r.id, r.updated_at])))
    }
    // 2. pull
    let cursor = getSettings().cursor || '1970-01-01T00:00:00Z'
    for (;;) {
      const { data, error } = await c.from('cardamom_items').select('id, kind, data, deleted, updated_at').eq('household_id', h.id).gt('updated_at', cursor).order('updated_at').limit(300)
      if (error) throw error
      if (!data.length) break
      const incoming = data.filter((r) => !getItem(r.id)?.dirty).map((r) => ({ ...r.data, id: r.id, kind: r.kind, deleted: r.deleted, u: r.updated_at }))
        .filter((r) => { const cur = getItem(r.id); return !cur || cur.u !== r.u })
      for (const r of incoming) { // a changed photo version means our local copies are stale
        const cur = getItem(r.id)
        if (cur && r.kind === 'recipe' && (cur.pv || 0) !== (r.pv || 0)) for (const idx of cur.photos || []) await deletePhoto(`${r.id}:${idx}`)
      }
      if (incoming.length) await saveItems(incoming, { fromSync: true })
      cursor = data[data.length - 1].updated_at
      await setSetting('cursor', cursor)
      if (data.length < 300) break
    }
    set({ state: 'ok', last: new Date(), message: '' })
    await syncPhotos(c, h)
  } catch (e) {
    set({ state: 'error', message: e.message || String(e) })
  }
}

let photoRun = false
async function syncPhotos(c, h) {
  if (photoRun) return
  photoRun = true
  try {
    const up = await unsyncedPhotos()
    const have = new Set(await allPhotoKeys())
    const down = []
    for (const r of listKind('recipe')) for (const idx of r.photos || []) if (!have.has(`${r.id}:${idx}`)) down.push({ r, idx })
    down.sort((a, b) => a.idx - b.idx)
    let left = up.length + down.length
    set({ photosLeft: left })
    const pool = async (list, fn) => { let i = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (i < list.length) { const x = list[i++]; try { await fn(x) } catch { /* retried next sync */ } set({ photosLeft: --left }) } })) }
    await pool(up, async (p) => {
      const { error } = await c.storage.from(BUCKET).upload(`${h.id}/${p.recipeId}/${p.idx}`, p.blob, { upsert: true, contentType: p.blob.type || 'image/jpeg' })
      if (error) throw error
      await markPhotoSynced(p.id)
    })
    await pool(down, async ({ r, idx }) => {
      const { data, error } = await c.storage.from(BUCKET).download(`${h.id}/${r.id}/${idx}`)
      if (error) throw error
      await putPhoto(r.id, idx, data, { synced: true })
      if (idx === 0) window.dispatchEvent(new CustomEvent('cardamom-photo', { detail: r.id }))
    })
    set({ photosLeft: 0 })
  } finally { photoRun = false }
}

let timer = null
export function startAutoSync() {
  setDirtyHook(() => { clearTimeout(timer); timer = setTimeout(syncNow, 2500) })
  rememberMe().catch(() => {})
  syncNow()
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 60000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow())
  window.addEventListener('online', syncNow)
}
