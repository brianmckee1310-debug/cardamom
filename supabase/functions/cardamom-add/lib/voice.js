// Turning what was said into something to do. All pure, so the whole command language can be
// tested without a microphone.

/** What a spoken phrase means inside cook mode, where the vocabulary is small. */
export function voiceCommand(said) {
  const s = said.toLowerCase()
  if (/\b(next|continue|forward|go on)\b/.test(s)) return 'next'
  if (/\b(back|previous|go back|last step)\b/.test(s)) return 'back'
  if (/\b(repeat|again|read|what was that)\b/.test(s) && !/ingredient/.test(s)) return 'repeat'
  if (/\bingredients?\b/.test(s)) return 'ingredients'
  if (/\b(start|set)\b.*\btimer\b|\btimer\b/.test(s)) return 'timer'
  if (/\b(stop|quiet|pause|shut up)\b/.test(s)) return 'stop'
  if (/\b(first|start over|beginning)\b/.test(s)) return 'first'
  return null
}

const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90 }
const numOf = (w) => (w == null ? null : /^\d+(\.\d+)?$/.test(w) ? parseFloat(w) : WORDS[w.toLowerCase()] ?? null)

/** "12 minutes", "an hour and a half", "90 seconds", "half an hour" -> seconds. */
export function parseDuration(text) {
  const s = String(text || '').toLowerCase()
  let total = 0, found = false
  if (/half an? hour/.test(s)) return 1800
  if (/an? hour and a half/.test(s)) return 5400
  const re = /(\d+(?:\.\d+)?|[a-z-]+)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/g
  for (let m; (m = re.exec(s));) {
    const n = numOf(m[1])
    if (n == null) continue
    found = true
    total += n * (/^h/.test(m[2]) ? 3600 : /^m/.test(m[2]) ? 60 : 1)
  }
  return found && total > 0 ? Math.round(total) : null
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['the', 'a', 'an', 'my', 'our', 'recipe', 'for', 'of', 'and', 'to', 'please'])
const toks = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w))

/**
 * Best match for a spoken name among a list of named things. Every spoken word has to appear
 * somewhere in the name, which keeps it from confidently picking the wrong recipe; among the
 * matches the shortest name wins, since that is the least padded one.
 */
export function matchNamed(said, items, nameOf = (x) => x.name) {
  const want = toks(said)
  if (!want.length || !items?.length) return null
  const hits = items.filter((x) => { const n = norm(nameOf(x)); return want.every((w) => n.includes(w)) })
  if (!hits.length) return null
  return hits.sort((a, b) => nameOf(a).length - nameOf(b).length)[0]
}

const DEFAULT_LIST = /^(grocer(y|ies)|shopping|food|the main|default)$/
/**
 * Which shopping list was named. Unnamed always means the default Groceries list, wherever you
 * happen to be in the app — predictable beats clever when you are not looking at the screen.
 * Returns { id } on a match, or { unknown } when a name was given that matches nothing.
 */
export function matchList(name, lists) {
  const n = norm(name).replace(/\blist\b/g, '').trim()
  if (!n || DEFAULT_LIST.test(n)) return { id: '' }
  const hit = matchNamed(n, lists)
  return hit ? { id: hit.id } : { unknown: n }
}

// Dictation writes small numbers as words ("two pounds of carrots"), but the quantity parser
// only reads digits, so the whole phrase would become the item's name. Convert a leading
// number word, but only when a unit or "of" follows it — otherwise "four cheese pizza" would
// lose its four, and a product name is worth more than a quantity we were not sure about.
const NUMWORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50 }
const UNITISH = /^(pounds?|lbs?|ounces?|oz|cups?|quarts?|qts?|pints?|pts?|gallons?|gal|grams?|g|kilos?|kilograms?|kgs?|liters?|litres?|l|ml|cans?|jars?|bags?|boxe?s?|bottles?|bunch(?:es)?|heads?|cloves?|sticks?|packs?|packages?|pkgs?|slices?|dozens?|loa(?:f|ves)|of)\b/i
export function spokenNumbers(text) {
  const t = String(text || '').trim()
  const m = t.match(/^([a-z]+)\s+(.+)$/i)
  if (!m) return t
  const n = NUMWORD[m[1].toLowerCase()]
  return n != null && UNITISH.test(m[2]) ? `${n} ${m[2]}` : t
}

const ADD = /^(?:add|put|get)\s+(.+?)(?:\s+(?:to|on|onto|in)\s+(?:the\s+|my\s+|our\s+)?(.+?))?$/
const LOG = /^(?:log|i (?:ate|had)|record)\s+(.+)$/
const COOK = /^(?:cook|start cooking|let'?s cook|cook mode|make)\s+(.+)$/
const OPEN = /^(?:open|show me|show|find|pull up|go to|switch to)\s+(.+)$/
const PLAN = /\bwhat(?:s| is| are)?\b.*\b(dinner|lunch|breakfast|tonight|planned|plan|today)\b|\bwhat am i (?:cooking|making)\b/

/**
 * Turn a sentence into an action. Order matters: the narrower patterns are tried first so
 * "add a 10 minute timer" is a timer rather than a grocery item called "a 10 minute timer".
 */
export function parseCommand(said, { lists = [], recipes = [] } = {}) {
  const raw = String(said || '').trim().replace(/[.!?]+$/, '')
  const s = norm(raw)
  if (!s) return null
  if (/^(stop|cancel|never ?mind|quiet|nothing)$/.test(s)) return { kind: 'stop' }

  if (/\btimer\b/.test(s) || /^(set|start)\b.*\b(hours?|minutes?|mins?|seconds?|secs?)\b/.test(s)) {
    const seconds = parseDuration(s)
    return seconds ? { kind: 'timer', seconds } : { kind: 'unclear', why: 'I did not catch how long.' }
  }
  if (PLAN.test(s)) return { kind: 'plan' }

  let m = raw.match(new RegExp(LOG, 'i'))
  if (m) return { kind: 'log', text: m[1].trim() }

  m = raw.match(new RegExp(COOK, 'i'))
  if (m) { const r = matchNamed(m[1], recipes); return r ? { kind: 'cook', id: r.id, name: r.name } : { kind: 'unclear', why: `I could not find a recipe called ${m[1].trim()}.` } }

  m = raw.match(new RegExp(OPEN, 'i'))
  if (m) {
    const tab = matchTab(m[1])
    if (tab) return { kind: 'tab', tab }
    const r = matchNamed(m[1], recipes)
    return r ? { kind: 'open', id: r.id, name: r.name } : { kind: 'unclear', why: `I could not find a recipe called ${m[1].trim()}.` }
  }

  m = raw.match(new RegExp(ADD, 'i'))
  if (m) {
    // "add a hammer" is a hammer: the article is not part of what you are buying, and
    // leaving it on would stop it combining with the hammer already on the list.
    const item = m[1].trim().replace(/^(?:an?|some)\s+(?=\S)/i, '').trim() || m[1].trim()
    const list = matchList(m[2] || '', lists)
    if (list.unknown) return { kind: 'unclear', why: `I do not have a list called ${list.unknown}.` }
    return { kind: 'add', item, list: list.id }
  }
  return null
}

const TABS = [['recipes', /^(recipes?|library|cookbook)$/], ['log', /^(log|food log|diary)$/], ['groceries', /^(groceries|grocery list|shopping list|the list)$/], ['planner', /^(planner|meal plan|the plan|calendar)$/], ['pantry', /^pantry$/], ['more', /^(more|settings)$/]]
export function matchTab(name) {
  const n = norm(name).replace(/^(the|my|our)\s+/, '')
  for (const [id, re] of TABS) if (re.test(n)) return id
  return null
}

/** What to say back, so you know it landed without looking. */
export function confirmText(cmd, extra = {}) {
  switch (cmd.kind) {
    case 'add': return `Added ${extra.name || cmd.item}${extra.listName ? ` to ${extra.listName}` : ' to groceries'}`
    case 'timer': return `Timer set for ${fmtDur(cmd.seconds)}`
    case 'cook': return `Cooking ${cmd.name}`
    case 'open': return `Opening ${cmd.name}`
    case 'tab': return `Opening ${cmd.tab}`
    case 'log': return extra.name ? `Logged ${extra.name}` : 'Logging that'
    case 'plan': return extra.text || 'Nothing planned'
    case 'unclear': return cmd.why
    default: return ''
  }
}
export function fmtDur(sec) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  if (h && m) return `${h} hour${h > 1 ? 's' : ''} ${m} minute${m > 1 ? 's' : ''}`
  if (h) return `${h} hour${h > 1 ? 's' : ''}`
  if (sec < 60) return `${sec} seconds`
  return `${m} minute${m > 1 ? 's' : ''}`
}
