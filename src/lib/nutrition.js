// Nutrient table, scaling, formatting and parsing. Pure functions: no React, no storage.
//
// `dv` is the FDA Daily Value for adults and children 4+ (21 CFR 101.9). It is a
// labelling reference, not a personal target, and the app says so wherever a % DV is drawn.
// `off` maps to an Open Food Facts nutriment key and `offMul` converts its unit (OFF stores
// weights in grams) into the unit used here.

export const NUTRIENTS = [
  { k: 'calories', label: 'Calories', unit: '', dv: 2000, group: 'macro', off: 'energy-kcal', offMul: 1 },
  { k: 'protein_g', label: 'Protein', unit: 'g', dv: 50, group: 'macro', off: 'proteins', offMul: 1 },
  { k: 'carbohydrates_g', label: 'Carbohydrates', unit: 'g', dv: 275, group: 'macro', off: 'carbohydrates', offMul: 1 },
  { k: 'fiber_g', label: 'Fiber', unit: 'g', dv: 28, group: 'macro', off: 'fiber', offMul: 1 },
  { k: 'sugar_g', label: 'Total sugars', unit: 'g', dv: null, group: 'macro', off: 'sugars', offMul: 1 },
  { k: 'added_sugar_g', label: 'Added sugars', unit: 'g', dv: 50, group: 'macro' },
  { k: 'fat_g', label: 'Fat', unit: 'g', dv: 78, group: 'macro', off: 'fat', offMul: 1 },
  { k: 'saturated_fat_g', label: 'Saturated fat', unit: 'g', dv: 20, group: 'macro', off: 'saturated-fat', offMul: 1 },
  { k: 'trans_fat_g', label: 'Trans fat', unit: 'g', dv: null, group: 'macro', off: 'trans-fat', offMul: 1 },
  { k: 'omega3_g', label: 'Omega-3', unit: 'g', dv: 1.6, group: 'macro', off: 'omega-3-fat', offMul: 1 },
  { k: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', dv: 300, group: 'macro', off: 'cholesterol', offMul: 1000 },
  { k: 'sodium_mg', label: 'Sodium', unit: 'mg', dv: 2300, group: 'macro', off: 'sodium', offMul: 1000 },

  { k: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg', dv: 900, group: 'vitamin', off: 'vitamin-a', offMul: 1e6 },
  { k: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', dv: 90, group: 'vitamin', off: 'vitamin-c', offMul: 1000 },
  { k: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg', dv: 20, group: 'vitamin', off: 'vitamin-d', offMul: 1e6 },
  { k: 'vitamin_e_mg', label: 'Vitamin E', unit: 'mg', dv: 15, group: 'vitamin', off: 'vitamin-e', offMul: 1000 },
  { k: 'vitamin_k_mcg', label: 'Vitamin K', unit: 'mcg', dv: 120, group: 'vitamin', off: 'vitamin-k', offMul: 1e6 },
  { k: 'thiamin_mg', label: 'Thiamin (B1)', unit: 'mg', dv: 1.2, group: 'vitamin', off: 'vitamin-b1', offMul: 1000 },
  { k: 'riboflavin_mg', label: 'Riboflavin (B2)', unit: 'mg', dv: 1.3, group: 'vitamin', off: 'vitamin-b2', offMul: 1000 },
  { k: 'niacin_mg', label: 'Niacin (B3)', unit: 'mg', dv: 16, group: 'vitamin', off: 'vitamin-pp', offMul: 1000 },
  { k: 'pantothenic_acid_mg', label: 'Pantothenic acid (B5)', unit: 'mg', dv: 5, group: 'vitamin', off: 'pantothenic-acid', offMul: 1000 },
  { k: 'vitamin_b6_mg', label: 'Vitamin B6', unit: 'mg', dv: 1.7, group: 'vitamin', off: 'vitamin-b6', offMul: 1000 },
  { k: 'biotin_mcg', label: 'Biotin (B7)', unit: 'mcg', dv: 30, group: 'vitamin', off: 'biotin', offMul: 1e6 },
  { k: 'folate_mcg', label: 'Folate (B9)', unit: 'mcg', dv: 400, group: 'vitamin', off: 'vitamin-b9', offMul: 1e6 },
  { k: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg', dv: 2.4, group: 'vitamin', off: 'vitamin-b12', offMul: 1e6 },
  { k: 'choline_mg', label: 'Choline', unit: 'mg', dv: 550, group: 'vitamin' },

  { k: 'calcium_mg', label: 'Calcium', unit: 'mg', dv: 1300, group: 'mineral', off: 'calcium', offMul: 1000 },
  { k: 'iron_mg', label: 'Iron', unit: 'mg', dv: 18, group: 'mineral', off: 'iron', offMul: 1000 },
  { k: 'magnesium_mg', label: 'Magnesium', unit: 'mg', dv: 420, group: 'mineral', off: 'magnesium', offMul: 1000 },
  { k: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg', dv: 1250, group: 'mineral', off: 'phosphorus', offMul: 1000 },
  { k: 'potassium_mg', label: 'Potassium', unit: 'mg', dv: 4700, group: 'mineral', off: 'potassium', offMul: 1000 },
  { k: 'zinc_mg', label: 'Zinc', unit: 'mg', dv: 11, group: 'mineral', off: 'zinc', offMul: 1000 },
  { k: 'copper_mg', label: 'Copper', unit: 'mg', dv: 0.9, group: 'mineral', off: 'copper', offMul: 1000 },
  { k: 'manganese_mg', label: 'Manganese', unit: 'mg', dv: 2.3, group: 'mineral', off: 'manganese', offMul: 1000 },
  { k: 'selenium_mcg', label: 'Selenium', unit: 'mcg', dv: 55, group: 'mineral', off: 'selenium', offMul: 1e6 },
  { k: 'iodine_mcg', label: 'Iodine', unit: 'mcg', dv: 150, group: 'mineral', off: 'iodine', offMul: 1e6 },
]

export const GROUPS = [['macro', 'Macros'], ['vitamin', 'Vitamins'], ['mineral', 'Minerals']]
export const KEYS = NUTRIENTS.map((n) => n.k)
export const BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.k, n]))
/** The four shown on the day summary. */
export const HEADLINE = ['calories', 'protein_g', 'carbohydrates_g', 'fat_g']

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null)

/** Keep only known keys with real numbers. Anything unknown is dropped. */
export function cleanNut(o) {
  const out = {}
  if (!o) return out
  for (const k of KEYS) { const v = num(typeof o[k] === 'string' ? parseFloat(o[k]) : o[k]); if (v != null && v >= 0) out[k] = v }
  return out
}
export const hasNut = (o) => !!o && KEYS.some((k) => num(o[k]) != null)

export function scaleNut(o, f) {
  const out = {}
  for (const k of KEYS) { const v = num(o?.[k]); if (v != null) out[k] = v * f }
  return out
}
export function sumNut(list) {
  const out = {}
  for (const o of list) for (const k of KEYS) { const v = num(o?.[k]); if (v != null) out[k] = (out[k] || 0) + v }
  return out
}
/** Percent of the FDA Daily Value, or null when there is no DV or no value. */
export function pctDv(k, v) {
  const dv = BY_KEY[k]?.dv
  const n = num(v)
  return dv && n != null ? Math.round((n / dv) * 100) : null
}

export function fmtAmt(v, unit) {
  const n = num(v)
  if (n == null) return '—'
  const r = n >= 100 || unit === 'mcg' || unit === '' ? Math.round(n) : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10
  return unit ? `${r} ${unit}` : String(r)
}
export const fmtKey = (k, v) => fmtAmt(v, BY_KEY[k]?.unit ?? '')

/** Calories implied by the macros, used to sanity-check an estimate. */
export const caloriesFromMacros = (o) => Math.round((num(o?.protein_g) || 0) * 4 + (num(o?.carbohydrates_g) || 0) * 4 + (num(o?.fat_g) || 0) * 9)

/**
 * The text that goes in a recipe's Nutrition field. Kept in "Label: value unit" lines so
 * Paprika shows it sensibly and so parseNutText can read it back.
 */
export function nutText(o, servings) {
  const lines = []
  if (servings) lines.push(`Per serving (estimated, ${servings} servings):`)
  for (const n of NUTRIENTS) { const v = num(o?.[n.k]); if (v != null) lines.push(`${n.label}: ${fmtAmt(v, n.unit)}`) }
  return lines.join('\n')
}

const LOOKUP = (() => {
  const m = new Map()
  for (const n of NUTRIENTS) {
    m.set(n.label.toLowerCase(), n.k)
    m.set(n.label.toLowerCase().replace(/\s*\(.*\)/, ''), n.k)
  }
  // what other apps and labels call them
  Object.entries({
    energy: 'calories', kcal: 'calories', calorie: 'calories', carbs: 'carbohydrates_g', carbohydrate: 'carbohydrates_g',
    'dietary fiber': 'fiber_g', fibre: 'fiber_g', 'dietary fibre': 'fiber_g', sugars: 'sugar_g', sugar: 'sugar_g',
    'total fat': 'fat_g', 'saturated fatty acids': 'saturated_fat_g', 'sat fat': 'saturated_fat_g',
    salt: 'sodium_mg', 'vitamin b1': 'thiamin_mg', 'vitamin b2': 'riboflavin_mg', 'vitamin b3': 'niacin_mg',
    'vitamin b5': 'pantothenic_acid_mg', 'vitamin b7': 'biotin_mcg', 'vitamin b9': 'folate_mcg',
    'folic acid': 'folate_mcg', 'omega 3': 'omega3_g', 'omega-3 fatty acids': 'omega3_g',
  }).forEach(([a, k]) => m.set(a, k))
  return m
})()

/** Read a nutrition block back out of free text, for recipes that only ever had the text. */
export function parseNutText(text) {
  const out = {}
  for (const raw of String(text || '').split('\n')) {
    const m = raw.match(/^\s*([A-Za-z][A-Za-z0-9 ()\-/]*?)\s*[:=]\s*([\d.]+)\s*(mcg|µg|ug|mg|g|kcal|cal)?/i)
    if (!m) continue
    const k = LOOKUP.get(m[1].trim().toLowerCase())
    if (!k || out[k] != null) continue
    let v = parseFloat(m[2])
    const u = (m[3] || '').toLowerCase()
    const want = BY_KEY[k].unit
    // only convert when the written unit disagrees with ours
    if (want === 'mg' && u === 'g') v *= 1000
    else if (want === 'mg' && (u === 'mcg' || u === 'µg' || u === 'ug')) v /= 1000
    else if (want === 'mcg' && u === 'mg') v *= 1000
    else if (want === 'mcg' && u === 'g') v *= 1e6
    else if (want === 'g' && u === 'mg') v /= 1000
    else if (want === 'g' && (u === 'mcg' || u === 'µg' || u === 'ug')) v /= 1e6
    if (isFinite(v)) out[k] = v
  }
  return out
}

/** Nutrition for one portion from an Open Food Facts product. `grams` is the portion size. */
export function fromOff(nutriments, grams = 100) {
  const out = {}
  if (!nutriments) return out
  const f = grams / 100
  for (const n of NUTRIENTS) {
    if (!n.off) continue
    const v = num(parseFloat(nutriments[`${n.off}_100g`]))
    if (v == null) continue
    out[n.k] = v * n.offMul * f
  }
  if (out.calories == null) {
    const kj = num(parseFloat(nutriments['energy-kj_100g']))
    if (kj != null) out.calories = (kj / 4.184) * f
  }
  if (out.sodium_mg == null) {
    const salt = num(parseFloat(nutriments.salt_100g))
    if (salt != null) out.sodium_mg = salt * 400 * f // 1 g salt ≈ 400 mg sodium
  }
  return out
}

/** "30 g", "1 cup (240ml)", "2 cookies (28g)" -> grams, when it can be read. */
export function gramsFromServing(text) {
  const m = String(text || '').match(/([\d.]+)\s*(g|gram|grams|ml)\b/i)
  return m ? parseFloat(m[1]) : null
}
