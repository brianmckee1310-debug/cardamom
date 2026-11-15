import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { scaleNut, sumNut, pctDv, parseNutText, nutText, fromOff, gramsFromServing, caloriesFromMacros, cleanNut, fmtAmt, hasNut, NUTRIENTS } from '../../src/lib/nutrition.js'
import { matchNotables, notablesForRecipe, mergeNotables, NOTABLES } from '../../src/lib/notables.js'
import { MEALS, guessMeal, entryTotals, dayTotals, byMeal, dayNotables, targetFor, DEFAULT_TARGET, recipeNut, entryFromRecipe, copyDay, macroSplit, entriesOn, adoptMine, describeEntry } from '../../src/lib/log.js'
import { saveItems, setSetting, wipeAll } from '../../src/store.js'
import { foodFromDescription, analyseNutrition } from '../../src/lib/gemini.js'
import { portionText } from '../../src/ui/LogSheets.jsx'

const reply = (obj) => async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) })

describe('nutrition maths', () => {
  it('scales and sums, dropping unknown keys', () => {
    expect(scaleNut({ calories: 100, protein_g: 5, bogus: 9 }, 2.5)).toEqual({ calories: 250, protein_g: 12.5 })
    expect(sumNut([{ calories: 100 }, { calories: 50, iron_mg: 2 }, null])).toEqual({ calories: 150, iron_mg: 2 })
    expect(scaleNut({}, 3)).toEqual({})
  })
  it('keeps numbers only', () => {
    expect(cleanNut({ calories: '250', protein_g: 'lots', fat_g: -4, zinc_mg: 1 })).toEqual({ calories: 250, zinc_mg: 1 })
    expect(hasNut({})).toBe(false); expect(hasNut({ calories: 1 })).toBe(true)
  })
  it('works out percent of the Daily Value', () => {
    expect(pctDv('vitamin_c_mg', 90)).toBe(100)
    expect(pctDv('calories', 500)).toBe(25)
    expect(pctDv('sugar_g', 10)).toBe(null) // total sugars has no DV
    expect(pctDv('nonsense', 5)).toBe(null)
  })
  it('rounds amounts the way a label would', () => {
    expect(fmtAmt(412.4, '')).toBe('412'); expect(fmtAmt(1.24, 'mg')).toBe('1.2 mg')
    expect(fmtAmt(12.6, 'g')).toBe('13 g'); expect(fmtAmt(null, 'g')).toBe('—')
  })
  it('reads its own text back', () => {
    const o = { calories: 350, protein_g: 12, sodium_mg: 480, vitamin_c_mg: 45, folate_mcg: 120 }
    expect(parseNutText(nutText(o, 4))).toEqual(o)
  })
  it('converts units when another app wrote them', () => {
    const p = parseNutText('Calories: 200\nSodium: 1.2 g\nVitamin C: 45000 mcg\nFiber: 3000 mg')
    expect(p.sodium_mg).toBe(1200); expect(p.vitamin_c_mg).toBe(45); expect(p.fiber_g).toBe(3)
  })
  it('understands label synonyms', () => {
    const p = parseNutText('Energy: 310\nCarbs: 40 g\nDietary Fibre: 4 g\nTotal Fat: 9 g')
    expect(p.calories).toBe(310); expect(p.carbohydrates_g).toBe(40); expect(p.fiber_g).toBe(4); expect(p.fat_g).toBe(9)
  })
  it('maps Open Food Facts grams into label units', () => {
    const n = { 'energy-kcal_100g': 250, proteins_100g: 8, sodium_100g: 0.5, 'vitamin-c_100g': 0.0106, calcium_100g: 0.12, selenium_100g: 0.0000155 }
    const per100 = fromOff(n, 100)
    expect(per100.calories).toBe(250); expect(per100.protein_g).toBe(8)
    expect(per100.sodium_mg).toBe(500); expect(Math.round(per100.vitamin_c_mg * 10) / 10).toBe(10.6)
    expect(per100.calcium_mg).toBe(120); expect(Math.round(per100.selenium_mcg)).toBe(16)
    const per30 = fromOff(n, 30)
    expect(per30.calories).toBe(75)
  })
  it('falls back to kilojoules and salt', () => {
    const o = fromOff({ 'energy-kj_100g': 1000, salt_100g: 1 }, 100)
    expect(Math.round(o.calories)).toBe(239); expect(o.sodium_mg).toBe(400)
  })
  it('reads grams out of a serving size, and gives up cleanly', () => {
    expect(gramsFromServing('30 g (about 12 chips)')).toBe(30)
    expect(gramsFromServing('1 cup (240 ml)')).toBe(240)
    expect(gramsFromServing('1 bar')).toBe(null); expect(gramsFromServing(undefined)).toBe(null)
  })
  it('checks calories against the macros', () => {
    expect(caloriesFromMacros({ protein_g: 10, carbohydrates_g: 20, fat_g: 5 })).toBe(165)
  })
  it('has a Daily Value for everything it draws a bar for', () => {
    for (const n of NUTRIENTS) if (n.dv != null) expect(n.dv).toBeGreaterThan(0)
    expect(NUTRIENTS.filter((n) => n.group === 'vitamin').length).toBeGreaterThan(10)
    expect(NUTRIENTS.filter((n) => n.group === 'mineral').length).toBeGreaterThan(8)
  })
})

describe('notables', () => {
  it('finds the well-known ones', () => {
    const labels = (s) => matchNotables(s).map((n) => n.label)
    expect(labels('1 cup rolled oats')).toContain('Beta-glucans')
    expect(labels('3 beets, roasted')).toContain('Nitrates')
    expect(labels('2 apples\n1 red onion')).toContain('Quercetin')
    expect(labels('1 lb broccoli')).toContain('Sulforaphane')
    expect(labels('2 tbsp tomato paste')).toContain('Lycopene')
    expect(labels('1 tsp turmeric\n1/2 tsp black pepper')).toEqual(expect.arrayContaining(['Curcumin', 'Piperine']))
  })
  it('flags hazards and the organic question', () => {
    const labels = (s) => matchNotables(s).map((n) => n.label)
    expect(labels('2 swordfish steaks')).toContain('High-mercury fish')
    expect(labels('1 lb bacon')).toContain('Processed meat')
    expect(labels('1 lb strawberries')).toContain('Worth buying organic')
    expect(labels('2 avocados')).toContain('No need to buy organic')
    expect(labels('1 cup dried kidney beans')).toContain('Dried beans need a hard boil')
  })
  it('is not fooled by words inside other words', () => {
    const labels = (s) => matchNotables(s).map((n) => n.label)
    expect(labels('1 pineapple')).not.toContain('Quercetin')
    expect(labels('1 eggplant, cubed')).not.toContain('Choline')
    expect(labels('1 slice gingerbread')).not.toContain('Gingerols')
    expect(labels('2 tbsp apple cider vinegar')).not.toContain('Pectin')
    expect(matchNotables('')).toEqual([])
    expect(matchNotables('   ')).toEqual([])
  })
  it('sorts goodies before cautions and respects the cap', () => {
    const hits = matchNotables('oats blueberries salmon bacon swordfish spinach beets garlic onion turmeric cocoa coffee wine liver', 14)
    expect(hits.length).toBeLessThanOrEqual(14)
    const firstCaution = hits.findIndex((h) => h.t === 'caution')
    if (firstCaution >= 0) expect(hits.slice(firstCaution).every((h) => h.t === 'caution')).toBe(true)
  })
  it('matches a recipe on its name and ingredients', () => {
    const r = { name: 'Oatmeal', ingredients: '1 cup oats\n1/2 cup blueberries' }
    expect(notablesForRecipe(r).map((n) => n.label)).toEqual(expect.arrayContaining(['Beta-glucans', 'Anthocyanins']))
  })
  it('merges AI extras without repeating the curated wording', () => {
    const curated = matchNotables('1 cup oats')
    const merged = mergeNotables(curated, [
      { t: 'good', label: 'Beta-glucans', text: 'an AI duplicate that should lose' },
      { t: 'good', label: 'Tocotrienols', text: 'a form of vitamin E unusual in oats.' },
      { t: 'caution', label: '', text: 'no label, dropped' },
    ])
    expect(merged.filter((n) => n.label === 'Beta-glucans')).toHaveLength(1)
    expect(merged.find((n) => n.label === 'Beta-glucans').text).not.toMatch(/duplicate/)
    expect(merged.find((n) => n.label === 'Tocotrienols').ai).toBe(true)
    expect(merged.some((n) => !n.label)).toBe(false)
  })
  it('keeps every entry well formed', () => {
    for (const n of NOTABLES) {
      expect(n.label.length).toBeGreaterThan(2)
      expect(n.text.length).toBeGreaterThan(30)
      expect(['good', 'caution']).toContain(n.t)
      expect(n.re.test('zzzz nothing here zzzz')).toBe(false)
    }
    expect(new Set(NOTABLES.map((n) => n.id)).size).toBe(NOTABLES.length)
  })
})

describe('the food log', () => {
  beforeEach(async () => { await wipeAll(); await setSetting('meId', 'me') })

  it('guesses the meal from the clock', () => {
    const at = (h) => guessMeal(new Date(2026, 0, 1, h))
    expect(at(8)).toBe('Breakfast'); expect(at(12)).toBe('Lunch'); expect(at(19)).toBe('Dinner'); expect(at(23)).toBe('Snack')
  })
  it('multiplies an entry by how much was eaten', () => {
    expect(entryTotals({ qty: 2, per: { calories: 120, protein_g: 4 } })).toEqual({ calories: 240, protein_g: 8 })
    expect(entryTotals({ qty: 0.5, per: { calories: 300 } })).toEqual({ calories: 150 })
    expect(entryTotals({ per: { calories: 300 } })).toEqual({ calories: 0 })
    expect(entryTotals(null)).toEqual({})
  })
  it('adds up a day and splits the macros', () => {
    const es = [{ qty: 1, per: { calories: 300, protein_g: 20 } }, { qty: 2, per: { calories: 100, fat_g: 5 } }]
    expect(dayTotals(es)).toEqual({ calories: 500, protein_g: 20, fat_g: 10 })
    const s = macroSplit({ protein_g: 25, carbohydrates_g: 25, fat_g: 0 })
    expect(s.protein).toBeCloseTo(0.5); expect(s.fat).toBe(0)
    expect(macroSplit({}).sum).toBe(0)
  })
  it('keeps each person to their own log', async () => {
    await saveItems([
      { kind: 'logentry', who: 'me', date: '2026-11-14', meal: 'Lunch', qty: 1, per: { calories: 400 }, name: 'Mine' },
      { kind: 'logentry', who: 'her', date: '2026-11-14', meal: 'Lunch', qty: 1, per: { calories: 700 }, name: 'Hers' },
    ])
    expect(entriesOn('2026-11-14', 'me').map((e) => e.name)).toEqual(['Mine'])
    expect(dayTotals(entriesOn('2026-11-14', 'me')).calories).toBe(400)
    expect(dayTotals(entriesOn('2026-11-14', 'her')).calories).toBe(700)
    expect(entriesOn('2026-11-13', 'me')).toEqual([])
  })
  it('claims pre-sign-in entries for whoever signs in', async () => {
    await saveItems([
      { kind: 'logentry', who: 'me', date: '2026-11-14', qty: 1, per: {}, name: 'Offline' },
      { kind: 'logentry', date: '2026-11-14', qty: 1, per: {}, name: 'No who at all' },
      { kind: 'logentry', who: 'her', date: '2026-11-14', qty: 1, per: {}, name: 'Hers' },
      { kind: 'target', who: 'me', values: { calories: 1800 } },
    ])
    expect(await adoptMine('uid-1')).toBe(2)
    expect(entriesOn('2026-11-14', 'uid-1').map((e) => e.name).sort()).toEqual(['No who at all', 'Offline'])
    expect(entriesOn('2026-11-14', 'her').map((e) => e.name)).toEqual(['Hers'])
    expect(targetFor('uid-1').calories).toBe(1800)
    expect(await adoptMine(null)).toBe(0)
  })
  it('buckets entries by meal, in meal order, snacks catching the rest', () => {
    const got = byMeal([{ meal: 'Dinner', name: 'd' }, { meal: 'Breakfast', name: 'b' }, { meal: 'Elevenses', name: '?' }])
    expect(got.map((g) => g.meal)).toEqual(MEALS)
    expect(got.find((g) => g.meal === 'Snack').entries.map((e) => e.name)).toEqual(['?'])
    expect(byMeal(null).every((g) => g.entries.length === 0)).toBe(true)
  })
  it('collects the day’s notables without repeats', () => {
    const list = dayNotables([
      { notables: [{ label: 'Beta-glucans', t: 'good', text: 'x' }, { label: 'Worth buying organic', t: 'caution', text: 'y' }] },
      { notables: [{ label: 'beta glucans', t: 'good', text: 'dupe by loose match' }, { label: 'Nitrates', t: 'good', text: 'z' }] },
      {},
    ])
    expect(list.map((n) => n.label)).toEqual(['Beta-glucans', 'Nitrates', 'Worth buying organic'])
  })
  it('falls back to Daily Values until a target is set', async () => {
    expect(targetFor('me')).toEqual(DEFAULT_TARGET)
    await saveItems([{ kind: 'target', who: 'me', values: { calories: 1750, protein_g: 110 } }])
    const t = targetFor('me')
    expect(t.calories).toBe(1750); expect(t.protein_g).toBe(110); expect(t.fiber_g).toBe(DEFAULT_TARGET.fiber_g)
  })
  it('takes a recipe’s numbers, or reads them out of its text', () => {
    expect(recipeNut({ nut: { calories: 420 } }).calories).toBe(420)
    expect(recipeNut({ nutritional_info: 'Calories: 310\nProtein: 9 g' })).toEqual({ calories: 310, protein_g: 9 })
    expect(recipeNut(null)).toEqual({})
    const e = entryFromRecipe({ id: 'R1', name: 'Chili', nut: { calories: 500 }, servings: '6' }, { date: '2026-11-14', meal: 'Dinner', qty: 2, who: 'me' })
    expect(e).toMatchObject({ kind: 'logentry', who: 'me', recipeId: 'R1', qty: 2, unit: 'serving' })
    expect(entryTotals(e).calories).toBe(1000)
  })
  it('copies a day onto another date as fresh records', () => {
    const copies = copyDay([{ id: 'OLD', u: 'stamp', dirty: 1, kind: 'logentry', name: 'Toast', qty: 1, per: { calories: 90 } }], '2026-11-15', 'me')
    expect(copies[0].id).toBeUndefined()
    expect(copies[0]).toMatchObject({ date: '2026-11-15', who: 'me', name: 'Toast' })
  })
  it('describes the amount in words', () => {
    expect(describeEntry({ qty: 1, unit: 'serving' })).toBe('1 serving')
    expect(describeEntry({ qty: 2, unit: 'serving' })).toBe('2 servings')
    expect(describeEntry({ qty: 1.5, unit: 'cup' })).toBe('1.5 cups')
    expect(describeEntry({ qty: 1, unit: '100 g' })).toBe('1 100 g')
  })
})

describe('AI nutrition (no network)', () => {
  it('returns numbers, label text and notables from one call', async () => {
    const out = await analyseNutrition({ key: 'K' }, { name: 'Oatmeal', ingredients: '1 cup oats', servings: '2' },
      reply({ calories: 300, protein_g: 10, carbohydrates_g: 54, fat_g: 5, iron_mg: 2, servings_assumed: 2, caveat: 'Assumes water, not milk.', notables: [{ t: 'good', label: 'Beta-glucans', text: 'Soluble fiber in oats.' }] }))
    expect(out.values).toMatchObject({ calories: 300, iron_mg: 2 })
    expect(out.text).toContain('Calories: 300')
    expect(out.text).toContain('Assumes water')
    expect(out.servings).toBe(2)
    expect(out.notables[0].label).toBe('Beta-glucans')
  })
  it('fills in calories from the macros when they are missing', async () => {
    const out = await analyseNutrition({ key: 'K' }, { name: 'x', ingredients: 'y' },
      reply({ protein_g: 10, carbohydrates_g: 20, fat_g: 5, servings_assumed: 1 }))
    expect(out.values.calories).toBe(165)
  })
  it('costs out a plain description for the whole amount eaten', async () => {
    const f = await foodFromDescription({ key: 'K' }, 'two eggs and buttered toast',
      reply({ name: 'Eggs and toast', portion: '2 eggs, 1 slice toast with butter', calories: 340, protein_g: 16, carbohydrates_g: 18, fat_g: 22, choline_mg: 300, notables: [{ t: 'good', label: 'Choline', text: 'Egg yolk is a good source.' }] }))
    expect(f.name).toBe('Eggs and toast'); expect(f.portion).toMatch(/2 eggs/)
    expect(f.per).toMatchObject({ calories: 340, choline_mg: 300 })
    expect(f.notables[0].label).toBe('Choline')
  })
  it('refuses an answer with no numbers in it at all', async () => {
    await expect(foodFromDescription({ key: 'K' }, 'something', reply({ name: 'Mystery', portion: 'some' }))).rejects.toThrow(/Could not work out/)
  })
  it('says plainly when Google is just busy', async () => {
    const busy = async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'The model is overloaded. Please try again later.' } }) })
    await expect(foodFromDescription({ key: 'K' }, 'x', busy)).rejects.toThrow(/Google is busy right now, not a problem with your key/)
    const badKey = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) })
    await expect(foodFromDescription({ key: 'K' }, 'x', badKey)).rejects.toThrow(/was not accepted/)
  })
})

describe('portion wording', () => {
  it('does not double the word servings', () => {
    expect(portionText('2 servings')).toBe('one of 2 servings')
    expect(portionText('4 Servings')).toBe('one of 4 Servings')
    expect(portionText('1 serving')).toBe('one of 1 serving')
    expect(portionText('6')).toBe('one of 6 servings')
    expect(portionText('makes 12 cookies')).toBe('makes 12 cookies')
    expect(portionText('8 slices')).toBe('8 slices')
  })
  it('says nothing when the recipe says nothing', () => {
    expect(portionText('')).toBe('')
    expect(portionText(null)).toBe('')
    expect(portionText(undefined)).toBe('')
  })
})
