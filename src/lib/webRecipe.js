// Extract a recipe from a web page's HTML (schema.org JSON-LD first, then page text for AI fallback).
const txt = (v) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(txt).filter(Boolean).join(', ') : v.name || v.text || v['@value'] || '')
export function decodeEntities(s) {
  return String(s).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}
const clean = (s) => decodeEntities(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()

export function isoDuration(d) {
  if (!d || typeof d !== 'string') return ''
  const m = d.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (!m) return d
  let mins = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0)
  if (!mins) return ''
  const h = Math.floor(mins / 60); mins %= 60
  return [h ? `${h} hr${h > 1 ? 's' : ''}` : '', mins ? `${mins} min${mins > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ')
}

function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipeNode(n); if (r) return r } return null }
  const t = node['@type']
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node
  return findRecipeNode(node['@graph']) || findRecipeNode(node.mainEntity) || findRecipeNode(node.mainEntityOfPage)
}

function instructions(v, out = []) {
  if (!v) return out
  if (typeof v === 'string') { clean(v).split('\n').forEach((l) => l.trim() && out.push(l.trim())); return out }
  if (Array.isArray(v)) { v.forEach((x) => instructions(x, out)); return out }
  if (v['@type'] === 'HowToSection') { if (v.name) out.push(clean(v.name).replace(/:?$/, ':')); instructions(v.itemListElement, out); return out }
  if (v.text || v.name) out.push(clean(v.text || v.name))
  else if (v.itemListElement) instructions(v.itemListElement, out)
  return out
}

function nutrition(n) {
  if (!n || typeof n !== 'object') return ''
  const map = { calories: 'Calories', carbohydrateContent: 'Carbohydrates', proteinContent: 'Protein', fatContent: 'Fat', saturatedFatContent: 'Saturated Fat', cholesterolContent: 'Cholesterol', sodiumContent: 'Sodium', fiberContent: 'Fiber', sugarContent: 'Sugar' }
  return Object.entries(map).filter(([k]) => n[k]).map(([k, label]) => `${label}: ${txt(n[k])}`).join('\n')
}

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))
  return m ? decodeEntities(m[1]) : ''
}

export function pageMeta(html) {
  return { title: meta(html, 'og:title') || clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]), description: meta(html, 'og:description') || meta(html, 'description'), image: meta(html, 'og:image'), site: meta(html, 'og:site_name') }
}

export function pageText(html) {
  return clean(html.replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 30000)
}

/** Returns a recipe draft or null if the page has no structured recipe. */
export function recipeFromHtml(html, url = '') {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  let node = null
  for (const b of blocks) {
    try { node = findRecipeNode(JSON.parse(b[1].trim())) } catch { try { node = findRecipeNode(JSON.parse(b[1].replace(/[\u0000-\u001f]+/g, ' '))) } catch { /* skip */ } }
    if (node) break
  }
  if (!node) return null
  const img = node.image
  const image = typeof img === 'string' ? img : Array.isArray(img) ? (typeof img[0] === 'string' ? img[0] : img[0]?.url) : img?.url
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '') } catch { /* no url */ }
  const yieldV = Array.isArray(node.recipeYield) ? node.recipeYield.map(String).sort((a, b) => b.length - a.length)[0] : node.recipeYield
  const cats = [node.recipeCategory, node.recipeCuisine].flat().filter(Boolean).flatMap((c) => String(c).split(',')).map((c) => decodeEntities(c).trim()).filter(Boolean)
  return {
    name: clean(node.name), description: clean(node.description),
    ingredients: (node.recipeIngredient || node.ingredients || []).map(clean).filter(Boolean).join('\n'),
    directions: instructions(node.recipeInstructions).join('\n\n'),
    servings: yieldV ? String(yieldV) : '', prep_time: isoDuration(node.prepTime), cook_time: isoDuration(node.cookTime), total_time: isoDuration(node.totalTime),
    nutritional_info: nutrition(node.nutrition), source: host || txt(node.author), source_url: url, image_url: image || '', suggested: cats,
  }
}
