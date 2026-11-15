import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { parseNumber, formatNumber, scaleLine, convertTemps, findTimers, splitSteps, groceryFromLine, guessAisle, isHeader, parseIngredient, clampQty, parseQty, stepQty } from '../../src/lib/ingredients.js'
import { recipeFromText } from '../../src/lib/textRecipe.js'
import { recipeFromHtml, isoDuration, pageMeta } from '../../src/lib/webRecipe.js'
import { buildIcs } from '../../src/lib/ics.js'
import { readPaprikaFile, writePaprikaFile, fromPaprika, toPaprika } from '../../src/lib/paprika.js'
import { draftFromAi, parseJsonLoose, formatNutrition, suggestCategoriesLocal, recipeFromText as aiText, suggestCategories } from '../../src/lib/gemini.js'
import { voiceCommand } from '../../src/lib/voice.js'

describe('quantities', () => {
  it('parses numbers', () => {
    expect(parseNumber('1 1/2')).toBe(1.5); expect(parseNumber('½')).toBe(0.5); expect(parseNumber('1½')).toBe(1.5); expect(parseNumber('3/4')).toBe(0.75); expect(parseNumber('2')).toBe(2)
  })
  it('formats fractions', () => { expect(formatNumber(1.5)).toBe('1 ½'); expect(formatNumber(0.3333)).toBe('⅓'); expect(formatNumber(3)).toBe('3'); expect(formatNumber(0.75)).toBe('¾') })
  it('scales lines', () => {
    expect(scaleLine('1 ½ pounds ground lamb, beef, or chicken', 2)).toBe('3 pounds ground lamb, beef, or chicken')
    expect(scaleLine('3-4 Tbsp white miso paste', 2)).toBe('6–8 Tbsp white miso paste')
    expect(scaleLine('1 yellow onion, chopped', 0.5)).toBe('½ yellow onion, chopped')
    expect(scaleLine('salt', 2)).toBe('salt')
    expect(scaleLine('1/2 cup milk', 3)).toBe('1 ½ cups milk')
    expect(scaleLine('4 cups vegetable broth', 1)).toBe('4 cups vegetable broth')
    expect(scaleLine('2 large eggs', 2)).toBe('4 large eggs')
    expect(scaleLine('1 (15 oz) can black beans', 2)).toBe('2 (15 oz) can black beans')
  })
  it('converts units', () => {
    expect(scaleLine('1 cup milk', 1, 'metric')).toBe('235 ml milk')
    expect(scaleLine('1 lb beef', 1, 'metric')).toBe('455 g beef')
    expect(scaleLine('2 tsp salt', 1, 'metric')).toBe('2 tsp salt')
    expect(scaleLine('500 g flour', 1, 'us')).toBe('1 ⅛ lb flour')
    expect(scaleLine('250 ml cream', 1, 'us')).toMatch(/^1 cup cream$/)
    expect(convertTemps('Bake at 350°F for 10 minutes', 'metric')).toBe('Bake at 175°C for 10 minutes')
    expect(convertTemps('Heat oven to 400 degrees F.', 'metric')).toContain('205°C')
    expect(convertTemps('Bake at 180°C', 'us')).toBe('Bake at 355°F')
  })
  it('recognises units without eating words', () => {
    expect(parseIngredient('2 T butter').unit).toBe('Tbsp'); expect(parseIngredient('2 t salt').unit).toBe('tsp'); expect(parseIngredient('1 Tbsp oil').unit).toBe('Tbsp')
    expect(parseIngredient('2 carrots').unit).toBe(null); expect(parseIngredient('3 garlic cloves').unit).toBe(null); expect(parseIngredient('1 lemon').unit).toBe(null); expect(parseIngredient('2 tomatoes').unit).toBe(null)
  })
  it('finds timers and steps', () => {
    expect(findTimers('Cook 2-5 minutes, then rest 1 hour').map((t) => t.seconds)).toEqual([300, 3600])
    expect(splitSteps('1. Mix.\n\n2. Bake.\nStep 3: Eat')).toEqual(['Mix.', 'Bake.', 'Eat'])
    expect(isHeader('For the sauce:')).toBe(true); expect(isHeader('1 cup rice')).toBe(false)
  })
  it('makes grocery items', () => {
    expect(groceryFromLine('2 cups chopped yellow onion, divided')).toEqual({ qty: '2 cups', name: 'chopped yellow onion' })
    expect(groceryFromLine('salt')).toEqual({ qty: '', name: 'salt' })
    expect(guessAisle('yellow onion')).toBe('Produce'); expect(guessAisle('ground beef')).toBe('Meat & Seafood'); expect(guessAisle('salted butter')).toBe('Dairy & Eggs'); expect(guessAisle('ground cumin')).toBe('Spices & Baking'); expect(guessAisle('dish soap')).toBe('Other')
  })
})

describe('text and web import', () => {
  it('reads headed text', () => {
    const r = recipeFromText('Best Toast\nServes 2\n\nIngredients:\n- 2 slices bread\n- 1 tbsp butter\n\nInstructions\n1. Toast bread.\n2. Butter it.')
    expect(r.name).toBe('Best Toast'); expect(r.servings).toBe('2'); expect(r.ingredients).toBe('2 slices bread\n1 tbsp butter'); expect(r.directions).toContain('Toast bread.')
  })
  it('reads unheaded captions', () => {
    const r = recipeFromText('Garlic noodles\n8 oz noodles\n4 cloves garlic\nBoil the noodles until tender.\nToss with garlic.')
    expect(r.ingredients.split('\n')).toHaveLength(2); expect(r.directions).toContain('Boil')
  })
  it('reads schema.org pages', () => {
    const html = `<html><head><meta property="og:image" content="https://x.test/a.jpg"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Miso &amp; Soup","recipeYield":["4","4 servings"],"prepTime":"PT5M","cookTime":"PT1H10M","recipeIngredient":["4 cups broth","1 sheet nori"],"recipeInstructions":[{"@type":"HowToSection","name":"Soup","itemListElement":[{"@type":"HowToStep","text":"Simmer broth."}]},{"@type":"HowToStep","text":"<p>Serve.</p>"}],"image":{"url":"https://x.test/b.jpg"},"recipeCategory":"Soup, Dinner","nutrition":{"calories":"170 kcal"}}]}</script></head></html>`
    const r = recipeFromHtml(html, 'https://www.example.com/miso')
    expect(r.name).toBe('Miso & Soup'); expect(r.servings).toBe('4 servings'); expect(r.prep_time).toBe('5 mins'); expect(r.cook_time).toBe('1 hr 10 mins')
    expect(r.ingredients).toBe('4 cups broth\n1 sheet nori'); expect(r.directions).toBe('Soup:\n\nSimmer broth.\n\nServe.'); expect(r.source).toBe('example.com'); expect(r.image_url).toBe('https://x.test/b.jpg'); expect(r.suggested).toEqual(['Soup', 'Dinner'])
    expect(recipeFromHtml('<html></html>')).toBe(null); expect(isoDuration('PT90M')).toBe('1 hr 30 mins'); expect(pageMeta(html).image).toBe('https://x.test/a.jpg')
  })
  it('builds a calendar', () => {
    const ics = buildIcs([{ id: 'A', date: '2026-11-30', type: 'Dinner', title: 'Tacos, salsa' }, { id: 'B', date: '2026-12-31', title: 'Out', deleted: true }], { stamp: new Date('2026-11-13T00:00:00Z') })
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130'); expect(ics).toContain('DTEND;VALUE=DATE:20261201'); expect(ics).toContain('SUMMARY:Dinner: Tacos\\, salsa'); expect(ics).not.toContain('Out'); expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

describe('ai helpers (no network)', () => {
  it('shapes replies', () => {
    expect(draftFromAi({ found: true, name: 'X', ingredients: ['1 a', '2 b'], directions: ['Do', 'Eat'] }).directions).toBe('Do\n\nEat')
    expect(() => draftFromAi({ found: false, name: '', ingredients: [], directions: [] })).toThrow(/No recipe/)
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(formatNutrition({ calories: 412.4, fat_g: 10, carbohydrates_g: 50, protein_g: 20, servings_assumed: 4 })).toContain('Calories: 412')
  })
  it('sends the key and parses the answer', async () => {
    let seen
    const fake = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"found":true,"name":"Toast","ingredients":["1 slice bread"],"directions":["Toast it"]}' }] } }] }) } }
    const d = await aiText({ key: 'K', model: 'm1' }, 'toast', fake)
    expect(d.name).toBe('Toast'); expect(seen.url).toContain('/models/m1:generateContent'); expect(seen.init.headers['x-goog-api-key']).toBe('K')
    await expect(aiText({ key: '' }, 'x', fake)).rejects.toThrow(/Gemini key/)
    const cats = await suggestCategories({ key: 'K' }, { name: 'x', ingredients: '' }, ['Chicken', 'Pasta'], async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"categories":["pasta","Made up"]}' }] } }] }) }))
    expect(cats).toEqual(['Pasta'])
  })
  it('suggests categories offline', () => {
    const all = ['Chicken', 'Pasta', 'Vegetarian', 'Dessert', 'Soup', '** Summer']
    expect(suggestCategoriesLocal({ name: 'Lemon Chicken Orzo Soup', ingredients: '1 lb chicken\n1 cup orzo', categories: [] }, all)).toEqual(['Chicken', 'Pasta', 'Soup'])
    expect(suggestCategoriesLocal({ name: 'Tomato soup', ingredients: '2 tomatoes', categories: ['Soup'] }, all)).toEqual(['Vegetarian'])
  })
  it('understands voice commands', () => {
    expect(voiceCommand('okay next step')).toBe('next'); expect(voiceCommand('go back')).toBe('back'); expect(voiceCommand('read the ingredients')).toBe('ingredients'); expect(voiceCommand('say that again')).toBe('repeat'); expect(voiceCommand('start the timer')).toBe('timer'); expect(voiceCommand('hello there')).toBe(null)
  })
})

describe('paprika files', () => {
  it('round-trips a recipe', async () => {
    const { recipe } = fromPaprika({ uid: 'abc', name: 'Soup', ingredients: '1 a', directions: 'Do', rating: 4, categories: ['Italian ', 'Soup'], photo_data: btoa('JPEGDATA'), photos: [{ name: '1', data: btoa('MORE') }] })
    expect(recipe.id).toBe('ABC'); expect(recipe.categories).toEqual(['Italian', 'Soup']); expect(recipe.photos).toEqual([0, 1])
    const zip = writePaprikaFile([{ recipe, photos: [{ idx: 0, bytes: new TextEncoder().encode('JPEGDATA') }, { idx: 1, bytes: new TextEncoder().encode('MORE') }] }])
    const got = []
    const res = await readPaprikaFile(new Blob([zip]), async (x) => got.push(x))
    expect(res.count).toBe(1); expect(got[0].recipe.name).toBe('Soup'); expect(got[0].recipe.rating).toBe(4); expect(got[0].photos.map((p) => new TextDecoder().decode(p.bytes))).toEqual(['JPEGDATA', 'MORE'])
    expect(toPaprika(recipe).uid).toBe('ABC')
    await expect(readPaprikaFile(new Blob(['hello world']), async () => {})).rejects.toThrow(/not a Paprika/)
  })
  const real = process.env.PAPRIKA_EXPORT
  it.skipIf(!real || !fs.existsSync(real || ''))('reads the real export', async () => {
    const file = new Blob([fs.readFileSync(real)])
    let n = 0, photos = 0, withIng = 0; const ids = new Set(); const cats = new Set()
    const res = await readPaprikaFile(file, async ({ recipe, photos: ps }) => { n++; photos += ps.length; ids.add(recipe.id); if (recipe.ingredients) withIng++; recipe.categories.forEach((c) => cats.add(c)); expect(recipe.name).toBeTruthy() })
    console.log(`real export: ${n} recipes, ${photos} photos, ${withIng} with ingredients, ${cats.size} categories, failed ${res.failed.length}`)
    expect(res.failed).toEqual([]); expect(n).toBe(473); expect(ids.size).toBe(473)
  }, 120000)
})

describe('typed-in amounts', () => {
  const LADDER = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]
  const B = { min: 0.05, max: 99 }

  it('accepts an arbitrary portion', () => {
    expect(parseQty('1.3', B)).toBe(1.3)
    expect(parseQty('0.4', B)).toBe(0.4)
    expect(parseQty('2', B)).toBe(2)
    expect(parseQty('1,5', B)).toBe(1.5) // a comma decimal, as a phone keyboard may give it
    expect(parseQty('  3.75  ', B)).toBe(3.75)
  })

  it('refuses junk rather than poisoning the total', () => {
    for (const bad of ['', '   ', 'abc', '.', '-', '-2', '0', 'NaN', null, undefined]) {
      expect(parseQty(bad, B)).toBe(null)
    }
  })

  it('keeps a typed amount inside bounds', () => {
    expect(parseQty('500', B)).toBe(99)
    expect(parseQty('0.0001', B)).toBe(0.05)
    expect(clampQty(1.23456, B)).toBe(1.235)
  })

  it('walks the ladder when it is standing on it', () => {
    expect(stepQty(1, 1, LADDER, B)).toBe(1.25)
    expect(stepQty(1, -1, LADDER, B)).toBe(0.75)
    expect(stepQty(0.25, -1, LADDER, B)).toBe(0.05) // off the bottom, clamped
    expect(stepQty(4, 1, LADDER, B)).toBe(5)        // off the top, falls back to a grain
  })

  it('steps to the next rung from an odd amount, so 1.3 is not a dead end', () => {
    expect(stepQty(1.3, 1, LADDER, B)).toBe(1.5)
    expect(stepQty(1.3, -1, LADDER, B)).toBe(1.25)
    expect(stepQty(0.4, 1, LADDER, B)).toBe(0.5)
    expect(stepQty(0.4, -1, LADDER, B)).toBe(0.33)
  })

  it('steps by a sensible grain with no ladder at all', () => {
    expect(stepQty(0.5, 1, null, B)).toBe(0.75)
    expect(stepQty(2, 1, null, B)).toBe(2.5)
    expect(stepQty(6, 1, null, B)).toBe(7)
    expect(stepQty(0.05, -1, null, B)).toBe(0.05)
  })

  it('scales an ingredient line by a typed factor', () => {
    expect(scaleLine('2 cups flour', 1.3)).toBe('2 \u215d cups flour')   // 2.6 -> 2 5/8
    expect(scaleLine('1 teaspoon salt', 1.3)).toBe('1 \u2153 teaspoon salt') // 1.3 -> 1 1/3
    expect(scaleLine('1/2 cup milk', 1.3)).toBe('\u2154 cup milk')  // 0.65 -> 2/3
  })
})
