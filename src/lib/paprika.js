// Read and write Paprika's export format: a zip of gzipped JSON files (.paprikarecipes).
import { Unzip, UnzipInflate, gunzipSync, gzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

export const FIELDS = ['name', 'description', 'ingredients', 'directions', 'notes', 'nutritional_info', 'prep_time', 'cook_time', 'total_time', 'difficulty', 'servings', 'source', 'source_url', 'image_url']

export function b64ToBytes(b64) {
  const bin = atob(b64); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
export function bytesToB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Paprika JSON -> { recipe, photos:[{idx, bytes}] } */
export function fromPaprika(p) {
  const recipe = { id: String(p.uid || '').toUpperCase() || crypto.randomUUID().toUpperCase(), kind: 'recipe' }
  for (const f of FIELDS) recipe[f] = typeof p[f] === 'string' ? p[f] : ''
  recipe.rating = Number(p.rating) || 0
  recipe.favorite = !!p.on_favorites
  recipe.categories = [...new Set((p.categories || []).map((c) => String(c).trim()).filter(Boolean))]
  recipe.created = p.created || new Date().toISOString().slice(0, 19).replace('T', ' ')
  const photos = []
  if (p.photo_data) photos.push({ idx: 0, bytes: b64ToBytes(p.photo_data) })
  ;(p.photos || []).forEach((ph, i) => { if (ph && ph.data) photos.push({ idx: i + 1, bytes: b64ToBytes(ph.data), name: ph.name }) })
  if (!p.photo_data && photos.length) photos[0].idx = 0
  recipe.photos = photos.map((x) => x.idx)
  return { recipe, photos }
}

export function toPaprika(recipe, photos = []) {
  const main = photos.find((p) => p.idx === 0)
  const out = { uid: recipe.id, created: recipe.created || '', hash: '', categories: recipe.categories || [], rating: recipe.rating || 0, on_favorites: !!recipe.favorite, cookbook_uid: null, photo: main ? recipe.id + '.jpg' : null, photo_large: null, photo_hash: null }
  for (const f of FIELDS) out[f] = recipe[f] || ''
  if (!out.image_url) out.image_url = null
  if (main) out.photo_data = bytesToB64(main.bytes)
  out.photos = photos.filter((p) => p.idx !== 0).map((p, i) => ({ name: String(i + 1), filename: `${recipe.id}-${p.idx}.jpg`, hash: '', data: bytesToB64(p.bytes) }))
  return out
}

export const parseEntry = (bytes) => fromPaprika(JSON.parse(strFromU8(gunzipSync(bytes))))

/**
 * Stream a .paprikarecipes file (any name) and call onRecipe for each recipe, one at a time,
 * so a 90 MB export never has to sit unpacked in memory.
 */
export async function readPaprikaFile(file, onRecipe, onProgress = () => {}) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (head[0] === 0x1f && head[1] === 0x8b) { await onRecipe(parseEntry(new Uint8Array(await file.arrayBuffer()))); return { count: 1, failed: [] } }
  if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new Error('That file is not a Paprika export.')
  const queue = []; const failed = []
  const unzip = new Unzip((entry) => {
    if (!/\.paprikarecipe$/i.test(entry.name)) return
    const chunks = []
    entry.ondata = (err, data, final) => {
      if (err) { failed.push(entry.name); return }
      chunks.push(data)
      if (final) {
        let len = 0; for (const c of chunks) len += c.length
        const all = new Uint8Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length }
        queue.push({ name: entry.name, bytes: all })
      }
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  let count = 0, read = 0
  const drain = async () => {
    while (queue.length) {
      const q = queue.shift()
      try { await onRecipe(parseEntry(q.bytes)); count++ } catch (e) { failed.push(q.name) }
    }
  }
  const CHUNK = 1 << 20
  for (let off = 0; off < file.size; off += CHUNK) {
    const buf = new Uint8Array(await file.slice(off, off + CHUNK).arrayBuffer())
    read += buf.length
    unzip.push(buf, off + CHUNK >= file.size)
    await drain()
    onProgress(read / file.size, count)
  }
  await drain()
  return { count, failed }
}

/** entries: [{recipe, photos}] -> Uint8Array zip Paprika can import */
export function writePaprikaFile(entries) {
  const files = {}; const used = new Set()
  for (const { recipe, photos } of entries) {
    let base = (recipe.name || 'Recipe').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80) || 'Recipe'
    let name = base, n = 2
    while (used.has(name.toLowerCase())) name = `${base} ${n++}`
    used.add(name.toLowerCase())
    files[name + '.paprikarecipe'] = [gzipSync(strToU8(JSON.stringify(toPaprika(recipe, photos)))), { level: 0 }]
  }
  return zipSync(files)
}
