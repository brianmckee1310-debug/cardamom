// Pure helpers: quantity parsing, scaling, unit conversion, aisle guessing, timers in text.
const FRAC = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }
const FR = Object.keys(FRAC).join('')
// one number: "1 1/2", "1½", "1/2", "½", "1.5", "2"
const NUM = `(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*[${FR}]|\\d+\\s*/\\s*\\d+|[${FR}]|\\d+(?:[.,]\\d+)?)`
const QTY_RE = new RegExp(`^\\s*(${NUM})(?:\\s*(?:-|–|—|to)\\s*(${NUM}))?`)

export function parseNumber(s) {
  s = s.trim()
  let m
  if ((m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) return +m[1] + +m[2] / +m[3]
  if ((m = s.match(new RegExp(`^(\\d+)\\s*([${FR}])$`)))) return +m[1] + FRAC[m[2]]
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) return +m[1] / +m[2]
  if (FRAC[s] != null) return FRAC[s]
  return parseFloat(s.replace(',', '.'))
}

const NICE = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞']]
export function formatNumber(n, { fractions = true } = {}) {
  if (!isFinite(n)) return ''
  if (!fractions) return String(n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 2) / 2 : Math.round(n * 10) / 10)
  const whole = Math.floor(n + 1e-9)
  const rest = n - whole
  if (rest < 0.0625) return String(whole || (n > 0.02 ? '⅛' : 0))
  if (rest > 0.9375) return String(whole + 1)
  if (n > 20) return String(Math.round(n))
  let best = NICE[0]
  for (const f of NICE) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f
  return whole ? `${whole} ${best[1]}` : best[1]
}

const UNITS = [
  // [canonical, regex, kind, toBase] base: ml or g
  ['tsp', /^(?:[Tt]easpoons?|[Tt]sps?\.?|t)(?![a-zA-Z])/, 'vol', 4.92892],
  ['Tbsp', /^(?:[Tt]ablespoons?|[Tt]bsps?\.?|[Tt]bs\.?|[Tt]bl\.?|T)(?![a-zA-Z])/, 'vol', 14.7868],
  ['cup', /^(cups?|c\.?)(?![a-z])/i, 'vol', 236.588],
  ['fl oz', /^(fluid ounces?|fl\.? ?oz\.?)(?![a-z])/i, 'vol', 29.5735],
  ['pint', /^(pints?|pt\.?)(?![a-z])/i, 'vol', 473.176],
  ['quart', /^(quarts?|qts?\.?)(?![a-z])/i, 'vol', 946.353],
  ['gallon', /^(gallons?|gal\.?)(?![a-z])/i, 'vol', 3785.41],
  ['ml', /^(milliliters?|millilitres?|ml)(?![a-z])/i, 'mvol', 1],
  ['l', /^(liters?|litres?|l)(?![a-z])/i, 'mvol', 1000],
  ['oz', /^(ounces?|oz\.?)(?![a-z])/i, 'wt', 28.3495],
  ['lb', /^(pounds?|lbs?\.?)(?![a-z])/i, 'wt', 453.592],
  ['g', /^(grams?|g)(?![a-z])/i, 'mwt', 1],
  ['kg', /^(kilograms?|kgs?|kilos?)(?![a-z])/i, 'mwt', 1000],
]

export function parseIngredient(line) {
  const m = line.match(QTY_RE)
  if (!m) return { qty: null, text: line.trim() }
  let rest = line.slice(m[0].length)
  const qty = parseNumber(m[1])
  const qty2 = m[2] ? parseNumber(m[2]) : null
  const lead = rest.match(/^\s*/)[0]
  const body = rest.slice(lead.length)
  let unit = null, after = body
  for (const u of UNITS) {
    // 't' and 'T' are case sensitive; everything else is not
    const mm = body.match(u[1])
    if (mm) { unit = u; after = body.slice(mm[0].length); break }
  }
  return { qty, qty2, unit: unit && unit[0], unitDef: unit, text: after.trim(), raw: line, head: line.slice(0, line.length - after.length).trim() }
}

export const isHeader = (line) => /:\s*$/.test(line.trim()) && !QTY_RE.test(line) || /^#+\s|^\*\*.*\*\*$/.test(line.trim()) || (/^[A-Z][A-Z \-&/']{2,}$/.test(line.trim()))

function metricPair(base, kind) {
  if (kind === 'vol') return base >= 1000 ? [base / 1000, 'l'] : [base, 'ml']
  return base >= 1000 ? [base / 1000, 'kg'] : [base, 'g']
}
function usPair(base, kind) {
  if (kind === 'mvol') {
    if (base < 14) return [base / 4.92892, 'tsp']
    if (base < 59) return [base / 14.7868, 'Tbsp']
    return [base / 236.588, base / 236.588 > 1.06 ? 'cups' : 'cup']
  }
  return base < 453 ? [base / 28.3495, 'oz'] : [base / 453.592, 'lb']
}
const roundMetric = (n) => (n >= 100 ? Math.round(n / 5) * 5 : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10)

/** Scale one ingredient line and optionally convert units. system: 'original' | 'metric' | 'us' */
export function scaleLine(line, factor = 1, system = 'original') {
  if (!line.trim() || isHeader(line)) return line
  const p = parseIngredient(line)
  if (p.qty == null || !isFinite(p.qty)) return line
  if (factor === 1 && system === 'original') return line
  let a = p.qty * factor, b = p.qty2 != null ? p.qty2 * factor : null
  let unit = p.unit, fractions = true
  const d = p.unitDef
  if (d && system === 'metric' && (d[2] === 'vol' || d[2] === 'wt') && d[0] !== 'tsp' && d[0] !== 'Tbsp') {
    const [v, u] = metricPair(a * d[3], d[2]); const scale = v / (a * d[3])
    a = roundMetric(v); if (b != null) b = roundMetric(b * d[3] * scale); unit = u; fractions = false
  } else if (d && system === 'us' && (d[2] === 'mvol' || d[2] === 'mwt')) {
    const [v, u] = usPair(a * d[3], d[2]); const scale = v / (a * d[3])
    a = v; if (b != null) b = b * d[3] * scale; unit = u
  } else if (d && (d[2] === 'mvol' || d[2] === 'mwt')) { a = roundMetric(a); if (b != null) b = roundMetric(b); fractions = false }
  else if (unit === 'cup' && a > 1.01) unit = 'cups'
  else if (d && unit === d[0]) unit = line.slice(line.match(QTY_RE)[0].length).trim().match(d[1])[0] // keep the writer's spelling
  let out = formatNumber(a, { fractions })
  if (b != null) out += '–' + formatNumber(b, { fractions })
  return [out, unit, p.text].filter(Boolean).join(' ')
}

export function convertTemps(text, system) {
  if (system === 'metric') return text.replace(/(\d{3})\s*(?:°|º|degrees?)\s*F?\b(?!\s*C)/g, (m, f) => `${Math.round(((+f - 32) * 5 / 9) / 5) * 5}°C`)
  if (system === 'us') return text.replace(/(\d{2,3})\s*(?:°|º|degrees?)\s*C\b/g, (m, c) => `${Math.round((+c * 9 / 5 + 32) / 5) * 5}°F`)
  return text
}

export const splitLines = (s) => (s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

/** Split directions into steps (blank-line or line separated), stripping leading numbering. */
export function splitSteps(s) {
  return splitLines(s).map((l) => l.replace(/^(?:step\s*)?\d+\s*[.):-]\s+/i, ''))
}

/** Find durations in a step: returns [{start,end,seconds,label}] */
export function findTimers(text) {
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi
  const out = []
  let m
  while ((m = re.exec(text))) {
    const n = parseFloat(m[2] || m[1])
    const u = m[3].toLowerCase()
    const mult = u.startsWith('h') ? 3600 : u.startsWith('m') ? 60 : 1
    out.push({ start: m.index, end: m.index + m[0].length, seconds: Math.round(n * mult), label: m[0] })
  }
  return out
}

export function parseServings(s) {
  const m = (s || '').match(/\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

const AISLES = [
  ['Produce', /\b(apple|avocado|banana|basil|bell pepper|berr(y|ies)|broccoli|cabbage|carrot|cauliflower|celery|chard|chive|cilantro|corn on|cucumber|dill|eggplant|garlic|ginger|grape|green onion|greens|herb|jalape|kale|leek|lemon|lettuce|lime|mango|mint|mushroom|onion|orange|parsley|peach|pear|pepper|pineapple|potato|radish|rosemary|scallion|shallot|spinach|squash|strawberr|thyme|tomato(?!.*(paste|sauce|canned|can ))|zucchini|arugula|asparagus|beet|sprout|fennel|sage)/i],
  ['Meat & Seafood', /\b(bacon|beef|brisket|chicken|chorizo|chuck|cod|crab|duck|fish|ham|lamb|meatball|pancetta|pork|prosciutto|ribs?|salmon|sausage|scallop|shrimp|steak|tilapia|tuna steak|turkey|kielbasa|halibut|mussel|clam)/i],
  ['Dairy & Eggs', /\b(butter(?!nut)|buttermilk|cheddar|cheese|cream|egg|feta|ghee|half[- ]and[- ]half|milk(?!.*coconut)|mozzarella|parmesan|ricotta|sour cream|yogurt|yoghurt|mascarpone|gruyere|provolone)/i],
  ['Bakery', /\b(bagel|baguette|bread|bun|ciabatta|naan|pita|roll|tortilla|croissant|english muffin)/i],
  ['Frozen', /\b(frozen|ice cream|puff pastry)/i],
  ['Spices & Baking', /\b(allspice|baking (powder|soda)|bay lea|cardamom|cayenne|chili powder|cinnamon|clove|cocoa|coriander|cornstarch|cumin|curry powder|flour|garam masala|nutmeg|oregano|paprika|pepper flakes|peppercorn|salt|seasoning|sugar|turmeric|vanilla|yeast|chocolate chip|sprinkles|powdered)/i],
  ['Beverages', /\b(beer|coffee|juice|soda|sparkling|tea|wine|vodka|rum|bourbon|whiskey|tequila)/i],
  ['Pantry', /\b(bean|broth|stock|can|canned|chickpea|coconut milk|honey|jam|ketchup|lentil|maple|mayo|mustard|noodle|nut|oat|oil|olive|pasta|peanut|quinoa|rice|sauce|soy|spaghetti|syrup|tahini|tomato|vinegar|orzo|gnocchi|panko|breadcrumb|miso|nori|salsa|chips)/i],
]
export function guessAisle(name) {
  for (const [aisle, re] of AISLES) if (re.test(name)) return aisle
  return 'Other'
}
export const AISLE_ORDER = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Spices & Baking', 'Frozen', 'Beverages', 'Household', 'Other']

/** "2 cups chopped yellow onion, divided" -> { qty:'2 cups', name:'chopped yellow onion' } */
export function groceryFromLine(line) {
  const p = parseIngredient(line)
  if (p.qty == null) return { qty: '', name: line.replace(/\(.*?\)/g, '').split(',')[0].trim() }
  const qty = p.head
  let name = p.text.replace(/\(.*?\)/g, '').replace(/^of\s+/i, '').split(',')[0].trim()
  // "3 cloves garlic" is garlic, counted in cloves: the counting word belongs with the amount
  const count = !p.unit && name.match(/^(cloves?|cans?|heads?|bunch(?:es)?|stalks?|sprigs?|slices?|jars?|packages?|pkgs?|bags?|box(?:es)?|bottles?|pieces?|sticks?|ears?|fillets?|links?)\s+(?:of\s+)?(?=\S)/i)
  if (count) return { qty: `${qty} ${count[1]}`, name: name.slice(count[0].length).trim() }
  return { qty, name: name || p.text }
}

// --- typed-in amounts ---------------------------------------------------------------------
// A portion is often not one of the round numbers on a stepper (1.3 of a recipe's servings,
// say), so the number is typable. These two are the whole of that arithmetic, kept pure.

export const clampQty = (n, { min = 0.05, max = 999 } = {}) =>
  Math.min(max, Math.max(min, Math.round(n * 1000) / 1000))

/** Read a typed amount. Returns null for anything that is not a usable positive number. */
export function parseQty(text, bounds) {
  const n = parseFloat(String(text ?? '').replace(',', '.').trim())
  if (!isFinite(n) || n <= 0) return null
  return clampQty(n, bounds)
}

/**
 * One press of +/-. On a value that sits on the ladder, move along it; off the ladder, move to
 * the next rung in that direction; with no ladder at all, step by a sensible grain.
 */
export function stepQty(value, dir, steps, bounds) {
  const v = Number(value) || 0
  if (steps && steps.length) {
    const i = steps.findIndex((s) => Math.abs(s - v) < 1e-9)
    if (i >= 0) { const next = steps[i + dir]; if (next != null) return clampQty(next, bounds) }
    else {
      const near = dir > 0 ? steps.find((s) => s > v + 1e-9) : [...steps].reverse().find((s) => s < v - 1e-9)
      if (near != null) return clampQty(near, bounds)
    }
  }
  const grain = v < 1 ? 0.25 : v < 4 ? 0.5 : 1
  return clampQty(v + dir * grain, bounds)
}
