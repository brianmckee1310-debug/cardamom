// Google Gemini calls (free key the user pastes in Settings). Every function takes the key/model as arguments.
const API = 'https://generativelanguage.googleapis.com/v1beta/models/'
export const DEFAULT_MODEL = 'gemini-flash-latest'

const RECIPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    found: { type: 'BOOLEAN', description: 'false if the content does not contain a recipe' },
    name: { type: 'STRING' }, description: { type: 'STRING' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' }, description: 'one ingredient per entry, quantity first; section headings end with a colon' },
    directions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'one step per entry, no numbering' },
    notes: { type: 'STRING' }, servings: { type: 'STRING' }, prep_time: { type: 'STRING' }, cook_time: { type: 'STRING' }, total_time: { type: 'STRING' }, source: { type: 'STRING' },
  },
  required: ['found', 'name', 'ingredients', 'directions'],
}
const RULES = 'Extract the recipe exactly as written. Do not invent ingredients, amounts or steps that are not present; if amounts are missing leave them out. If it is spoken or shown in a video, write down what is said and shown. Keep the original language and units.'

export function blobToB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob) })
}

async function call({ key, model }, body, fetchFn = fetch) {
  if (!key) throw new Error('Add your free Gemini key in Settings first.')
  const res = await fetchFn(`${API}${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json.error?.message || `Gemini error ${res.status}`
    if (res.status === 429) throw new Error('Gemini free limit reached for now. Try again in a minute.')
    if (res.status === 400 && /API key/i.test(msg)) throw new Error('That Gemini key was not accepted. Check it in Settings.')
    throw new Error(msg)
  }
  const text = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  if (!text) throw new Error('Gemini returned nothing for that.')
  return text
}

export function parseJsonLoose(text) {
  try { return JSON.parse(text) } catch { /* fall through */ }
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  if (m) return JSON.parse(m[1])
  throw new Error('Could not read the AI reply.')
}

export function draftFromAi(o) {
  if (!o || o.found === false || !(o.ingredients?.length || o.directions?.length)) throw new Error('No recipe found in that.')
  return {
    name: o.name || 'Untitled recipe', description: o.description || '', notes: o.notes || '',
    ingredients: (o.ingredients || []).join('\n'), directions: (o.directions || []).join('\n\n'),
    servings: o.servings || '', prep_time: o.prep_time || '', cook_time: o.cook_time || '', total_time: o.total_time || '', source: o.source || '',
  }
}
const json = (schema) => ({ responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 })

export async function recipeFromText(cfg, text, fetchFn) {
  const out = await call(cfg, { contents: [{ parts: [{ text: `${RULES}\n\nCONTENT:\n${text.slice(0, 40000)}` }] }], generationConfig: json(RECIPE_SCHEMA) }, fetchFn)
  return draftFromAi(parseJsonLoose(out))
}

export async function recipeFromImages(cfg, blobs, fetchFn) {
  const parts = [{ text: `${RULES} These are photos or screenshots of one recipe (cookbook page, recipe card, handwritten note or app screenshot), possibly split over several images.` }]
  for (const b of blobs) parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: await blobToB64(b) } })
  const out = await call(cfg, { contents: [{ parts }], generationConfig: json(RECIPE_SCHEMA) }, fetchFn)
  return draftFromAi(parseJsonLoose(out))
}

/** Gemini can watch public YouTube videos directly. */
export async function recipeFromYouTube(cfg, url, fetchFn) {
  const out = await call(cfg, { contents: [{ parts: [{ fileData: { fileUri: url } }, { text: `${RULES} Write out the recipe made in this video.` }] }], generationConfig: json(RECIPE_SCHEMA) }, fetchFn)
  return draftFromAi(parseJsonLoose(out))
}

/** Let Gemini open a public page itself (used when our own page fetch is blocked). */
export async function recipeFromUrl(cfg, url, fetchFn) {
  const out = await call(cfg, { contents: [{ parts: [{ text: `${RULES}\nOpen this page and extract the recipe on it: ${url}\nReply with only a JSON object with keys found, name, description, ingredients (array), directions (array), notes, servings, prep_time, cook_time, total_time, source.` }] }], tools: [{ urlContext: {} }], generationConfig: { temperature: 0.1 } }, fetchFn)
  return draftFromAi(parseJsonLoose(out))
}

const NUTRITION_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(['calories', 'fat_g', 'saturated_fat_g', 'carbohydrates_g', 'fiber_g', 'sugar_g', 'protein_g', 'sodium_mg', 'cholesterol_mg'].map((k) => [k, { type: 'NUMBER' }]).concat([['servings_assumed', { type: 'NUMBER' }], ['caveat', { type: 'STRING', description: 'short note on the biggest uncertainty, or empty' }]])),
  required: ['calories', 'fat_g', 'carbohydrates_g', 'protein_g', 'servings_assumed'],
}
export function formatNutrition(n) {
  const r = (v) => (v == null ? null : Math.round(v))
  const rows = [['Calories', r(n.calories), ''], ['Fat', r(n.fat_g), ' g'], ['Saturated Fat', r(n.saturated_fat_g), ' g'], ['Carbohydrates', r(n.carbohydrates_g), ' g'], ['Fiber', r(n.fiber_g), ' g'], ['Sugar', r(n.sugar_g), ' g'], ['Protein', r(n.protein_g), ' g'], ['Sodium', r(n.sodium_mg), ' mg'], ['Cholesterol', r(n.cholesterol_mg), ' mg']]
  const lines = [`Per serving (estimated, ${n.servings_assumed} servings):`, ...rows.filter((x) => x[1] != null).map(([k, v, u]) => `${k}: ${v}${u}`)]
  if (n.caveat) lines.push(n.caveat)
  return lines.join('\n')
}
export async function analyseNutrition(cfg, recipe, fetchFn) {
  const out = await call(cfg, { contents: [{ parts: [{ text: `Estimate nutrition PER SERVING for this recipe using standard food composition data. Servings stated: "${recipe.servings || 'not stated'}" (if not stated, pick a sensible number and report it). Count optional items as half. \n\nRECIPE: ${recipe.name}\nINGREDIENTS:\n${recipe.ingredients}` }] }], generationConfig: json(NUTRITION_SCHEMA) }, fetchFn)
  return formatNutrition(parseJsonLoose(out))
}

export async function suggestCategories(cfg, recipe, existing, fetchFn) {
  const schema = { type: 'OBJECT', properties: { categories: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['categories'] }
  const out = await call(cfg, { contents: [{ parts: [{ text: `Pick the categories that fit this recipe. Choose ONLY from this list, copying names exactly, at most 5:\n${existing.join('\n')}\n\nRECIPE: ${recipe.name}\nINGREDIENTS:\n${recipe.ingredients}\nDIRECTIONS:\n${(recipe.directions || '').slice(0, 1500)}` }] }], generationConfig: json(schema) }, fetchFn)
  const set = new Map(existing.map((c) => [c.toLowerCase(), c]))
  return [...new Set((parseJsonLoose(out).categories || []).map((c) => set.get(String(c).toLowerCase())).filter(Boolean))]
}

/** Offline fallback: match category names (and a few synonyms) against the recipe text. */
const HINTS = { vegetarian: null, chicken: /chicken/, pork: /pork|bacon|ham\b|sausage|prosciutto/, pasta: /pasta|spaghetti|penne|orzo|noodle|linguine|fettuccine|ziti|rigatoni|macaroni|gnocchi/, 'seafood/fish': /salmon|shrimp|cod\b|fish|tuna|scallop|crab|lobster|clam|mussel/, dessert: /cookie|cake|brownie|frosting|icing|pie\b|crisp|ice cream|pudding/, breakfast: /pancake|waffle|french toast|omelet|breakfast|granola|muffin/, soup: /soup|chowder|stew|bisque/, salad: /salad/, sandwich: /sandwich|burger|sloppy joe|panini|wrap\b/, turkey: /turkey/, egg: /\beggs?\b/, mushroom: /mushroom/, 'instant pot': /instant pot|pressure cook/, 'air fryer': /air fryer/, 'grill/fire': /grill/, 'flatbread/pizza': /pizza|flatbread/, sourdough: /sourdough/, lamb: /lamb/, duck: /duck/, dip: /\bdip\b/, casserole: /casserole/, bread: /bread|loaf/ }
const MEAT = /chicken|beef|pork|bacon|ham\b|sausage|turkey|lamb|salmon|shrimp|fish|tuna|anchov|prosciutto|steak|duck|crab|scallop|chorizo|pancetta|gelatin|cod\b/
export function suggestCategoriesLocal(recipe, existing) {
  const hay = `${recipe.name}\n${recipe.ingredients}`.toLowerCase()
  const out = []
  for (const c of existing) {
    const k = c.toLowerCase().trim()
    if (k === 'vegetarian') { if (recipe.ingredients && !MEAT.test(hay)) out.push(c); continue }
    const re = HINTS[k]
    if (re ? re.test(hay) : k.length > 3 && /^[a-z ]+$/.test(k) && hay.includes(k)) out.push(c)
  }
  return out.filter((c) => !(recipe.categories || []).includes(c)).slice(0, 6)
}
