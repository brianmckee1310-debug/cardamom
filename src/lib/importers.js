// Orchestrates "get me a recipe from this link / text / photo".
import { recipeFromHtml, pageMeta, pageText } from './webRecipe.js'
import { recipeFromText as localFromText } from './textRecipe.js'
import * as ai from './gemini.js'
import { sb, session, functionsUrl } from './sync.js'
import { getSettings } from '../store.js'

export const aiCfg = () => ({ key: getSettings().geminiKey || '', model: getSettings().geminiModel || ai.DEFAULT_MODEL })
export const hasAi = () => !!getSettings().geminiKey
const SOCIAL = /(instagram\.com|tiktok\.com|facebook\.com|fb\.watch|pinterest\.|threads\.net|threads\.com|x\.com|twitter\.com|reddit\.com)/i
const YOUTUBE = /(youtube\.com\/(watch|shorts)|youtu\.be\/)/i
export const firstUrl = (text) => ((text || '').match(/https?:\/\/[^\s<>"']+/) || [])[0] || ''

const PROXIES = [(u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`, (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`]

async function viaFunction(url, as) {
  const s = sb() && (await session())
  if (!s) return null
  const res = await fetch(functionsUrl('cardamom-fetch') + (as ? `?as=${as}` : ''), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` }, body: JSON.stringify({ url }) })
  return res.ok ? res : null
}
export async function fetchPage(url) {
  try { const r = await viaFunction(url); if (r) return await r.text() } catch { /* try proxies */ }
  for (const p of PROXIES) {
    try { const r = await fetch(p(url), { signal: AbortSignal.timeout(15000) }); if (r.ok) { const t = await r.text(); if (t.length > 500) return t } } catch { /* next */ }
  }
  return null
}
export async function fetchImage(url) {
  if (!url) return null
  const tries = [() => viaFunction(url, 'image'), () => fetch(url), ...PROXIES.map((p) => () => fetch(p(url), { signal: AbortSignal.timeout(15000) }))]
  for (const t of tries) {
    try { const r = await t(); if (r && r.ok) { const b = await r.blob(); if (b.type.startsWith('image/') && b.size > 1000) return b } } catch { /* next */ }
  }
  return null
}

/** Returns { draft, via } - via says how it was read, shown to the user so they know how much to trust it. */
export async function importFromUrl(url, extraText = '') {
  const cfg = aiCfg()
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '') } catch { throw new Error('That does not look like a link.') }
  const finish = (draft, via, more = {}) => ({ draft: { source: host, ...draft, source_url: url, ...more }, via })
  if (YOUTUBE.test(url) && cfg.key) return finish(await ai.recipeFromYouTube(cfg, url), 'Watched by AI')
  const html = await fetchPage(url)
  if (html) {
    const structured = recipeFromHtml(html, url)
    if (structured && structured.ingredients) return { draft: structured, via: 'Read from the page' }
    const meta = pageMeta(html)
    const isSocial = SOCIAL.test(url) || YOUTUBE.test(url)
    const text = [meta.title, meta.description, extraText, isSocial ? '' : pageText(html)].filter(Boolean).join('\n\n')
    if (cfg.key && text.length > 80) {
      try { return finish(await ai.recipeFromText(cfg, text), isSocial ? 'Read from the caption by AI' : 'Read by AI', { image_url: meta.image || '', source: meta.site || host }) } catch (e) { if (!isSocial) throw e }
    }
    if (isSocial && meta.description && meta.description.length > 120) return finish(localFromText(`${meta.title}\n${meta.description}`), 'Caption only, please check', { image_url: meta.image || '' })
  }
  if (cfg.key && !SOCIAL.test(url)) return finish(await ai.recipeFromUrl(cfg, url), 'Opened by AI')
  if (SOCIAL.test(url)) throw new Error('That post could not be read directly. Copy its caption and use Paste, or screenshot it and use Scan.')
  throw new Error(cfg.key ? 'Could not read that page.' : 'Could not read that page. Adding a Gemini key in Settings lets AI read pages that block apps.')
}

export async function importFromText(text) {
  const url = firstUrl(text)
  if (url && text.trim().length < url.length + 40) return importFromUrl(url)
  if (hasAi()) { try { return { draft: await ai.recipeFromText(aiCfg(), text), via: 'Read by AI' } } catch (e) { if (!/No recipe/.test(e.message)) return { draft: localFromText(text), via: 'Basic reading (AI failed: ' + e.message + ')' }; throw e } }
  return { draft: localFromText(text), via: 'Basic reading, please check' }
}
export const importFromImages = async (blobs) => ({ draft: await ai.recipeFromImages(aiCfg(), blobs), via: 'Scanned by AI' })

export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,categories_tags`)
  if (!res.ok) throw new Error('Lookup failed')
  const j = await res.json()
  if (j.status !== 1 || !j.product) return null
  const p = j.product
  const name = [p.brands?.split(',')[0], p.product_name].filter(Boolean).join(' ').trim()
  return name ? { name, qty: p.quantity || '' } : null
}
