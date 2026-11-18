import { describe, it, expect } from 'vitest'
import { normName, sameItem, looseMatch, mergeQty, mergeIntoList, pantryUpserts, cookable } from '../../src/lib/grocery.js'

describe('grocery names', () => {
  it('sees through plurals, sizes and prep words', () => {
    expect(sameItem('2 Fresh Yellow Onions', 'yellow onion')).toBe(true)
    expect(sameItem('Tomatoes', 'tomato')).toBe(true)
    expect(sameItem('Garlic cloves', 'garlic clove')).toBe(true)
    expect(sameItem('peaches', 'peach')).toBe(true)
    expect(normName('swiss cheese')).toBe('swiss cheese'); expect(normName('asparagus')).toBe('asparagus'); expect(normName('hummus')).toBe('hummus')
  })
  it('keeps different things apart', () => {
    expect(sameItem('red onion', 'yellow onion')).toBe(false)
    expect(sameItem('garlic', 'garlic powder')).toBe(false)
    expect(sameItem('', '')).toBe(false)
  })
  it('matches loosely for "do we have it"', () => {
    expect(looseMatch('garlic cloves', 'Garlic')).toBe(true)
    expect(looseMatch('olive oil', 'butter')).toBe(false)
    expect(looseMatch('', 'butter')).toBe(false)
  })
})

describe('combining amounts', () => {
  it('adds like to like', () => {
    expect(mergeQty('1 cup', '2 cups')).toBe('3 cups'); expect(mergeQty('1 cup', '1 cup')).toBe('2 cups')
    expect(mergeQty('2', '3')).toBe('5'); expect(mergeQty('1/2 cup', '1/4 cup')).toBe('¾ cup')
  })
  it('never invents a sum across units', () => {
    expect(mergeQty('1 lb', '2 cups')).toBe('1 lb + 2 cups'); expect(mergeQty('1 bunch', '2')).toBe('1 bunch + 2')
  })
  it('handles a missing side', () => { expect(mergeQty('', '2 cups')).toBe('2 cups'); expect(mergeQty('3', '')).toBe('3'); expect(mergeQty('', '')).toBe('') })
})

describe('merging into a list', () => {
  const have = [{ id: 'A', name: 'Yellow onion', qty: '1', recipe: 'Chili' }, { id: 'B', name: 'Milk', qty: '', done: true }, { id: 'C', name: 'Screws', list: 'L2' }]
  it('combines with what is still to buy, on the same list only', () => {
    const out = mergeIntoList(have, [{ name: 'yellow onions', qty: '2', recipe: 'Soup' }, { name: 'milk', qty: '1 gallon' }, { name: 'screws', qty: '' }])
    expect(out.find((o) => o.id === 'A')).toMatchObject({ qty: '3', recipe: 'Chili, Soup' })
    expect(out.filter((o) => !o.id).map((o) => o.name)).toEqual(['milk', 'screws']) // bought milk and the other list's screws are left alone
  })
  it('combines duplicates arriving together', () => {
    const out = mergeIntoList([], [{ name: 'Garlic', qty: '3 cloves', recipe: 'Soup' }, { name: 'garlic', qty: '2 cloves', recipe: 'Chili' }])
    expect(out).toHaveLength(1); expect(out[0]).toMatchObject({ qty: '5 cloves', recipe: 'Soup, Chili' })
  })
  it('flags the combined line if any copy arriving together was flagged', () => {
    expect(mergeIntoList([], [{ name: 'garlic', check: true }, { name: 'garlic' }])[0].check).toBe(true)
    expect(mergeIntoList([], [{ name: 'garlic' }, { name: 'garlic' }])[0].check).toBe(false)
  })
  it('leaves the state of something already on the list alone', () => {
    expect(mergeIntoList([{ id: 'A', name: 'garlic' }], [{ name: 'garlic', check: true }])[0].check).toBe(false)
    expect(mergeIntoList([{ id: 'A', name: 'garlic', check: true }], [{ name: 'garlic' }])[0].check).toBe(true)
  })
})

describe('the self-filling pantry', () => {
  it('adds new things and revives ones marked out, without duplicates', () => {
    const pantry = [{ id: 'P1', name: 'Olive oil', inStock: false }, { id: 'P2', name: 'Rice', inStock: true, seen: '2026-11-16' }]
    const out = pantryUpserts(pantry, [{ name: 'olive oil' }, { name: 'rice' }, { name: 'Cumin', aisle: 'Spices & Baking' }, { name: 'cumin' }], '2026-11-16')
    expect(out.find((o) => o.id === 'P1')).toMatchObject({ inStock: true, seen: '2026-11-16' })
    expect(out.some((o) => o.id === 'P2')).toBe(false)
    expect(out.filter((o) => !o.id)).toHaveLength(1)
  })
})

describe('what can I make', () => {
  const recipes = [
    { name: 'Toast', ingredients: '2 slices bread\n1 tbsp butter\nsalt' },
    { name: 'Soup', ingredients: 'FOR THE SOUP:\n1 onion\n2 carrots\n1 leek\n4 cups stock' },
    { name: 'Cake', ingredients: '2 cups flour\n1 cup sugar\n3 eggs\n1 cup milk' },
  ]
  it('ranks by what is missing and ignores salt and headers', () => {
    const got = cookable(recipes, [{ name: 'Bread' }, { name: 'butter' }, { name: 'onions' }, { name: 'carrot' }])
    expect(got.map((g) => g.recipe.name)).toEqual(['Toast', 'Soup'])
    expect(got[0].missing).toEqual([]); expect(got[1].missing).toEqual(['leek', 'stock'])
  })
  it('ignores things marked out, and says nothing with an empty pantry', () => {
    expect(cookable(recipes, [{ name: 'bread', inStock: false }, { name: 'butter', inStock: false }])).toEqual([])
    expect(cookable(recipes, [])).toEqual([])
  })
})

import { SEP, parts, leaf, parent, depth, normalizeCat, isUnder, ancestors, inCategory, categoryTree, visibleNodes, hasChildren, renameMap, applyRename } from '../../src/lib/categories.js'
import { moveItem, dropIndex } from '../../src/ui/DragList.jsx'
import { guessAisle, aisleList, fallbackAisle, AISLE_ORDER } from '../../src/lib/ingredients.js'
import { mealTypeList, MEAL_TYPES } from '../../src/lib/ics.js'

describe('subcategories', () => {
  it('reads a path however it was typed', () => {
    expect(normalizeCat('Dinner>Pasta')).toBe('Dinner > Pasta')
    expect(normalizeCat('  Dinner   >   Pasta  ')).toBe('Dinner > Pasta')
    expect(normalizeCat('> Dinner >')).toBe('Dinner')
    expect(leaf('A > B > C')).toBe('C'); expect(parent('A > B > C')).toBe('A > B'); expect(depth('A > B')).toBe(1); expect(depth('A')).toBe(0)
    expect(parts('A > B')).toEqual(['A', 'B']); expect(ancestors('A > B > C')).toEqual(['A', 'A > B'])
  })
  it('knows what is under what, without matching by prefix alone', () => {
    expect(isUnder('Dinner > Pasta', 'Dinner')).toBe(true)
    expect(isUnder('Dinner', 'Dinner')).toBe(true)
    expect(isUnder('Dinner Rolls', 'Dinner')).toBe(false)
    expect(isUnder('Dinner', 'Dinner > Pasta')).toBe(false)
    expect(isUnder('Dinner', '')).toBe(false)
  })
  it('counts a parent as everything beneath it', () => {
    const t = categoryTree([['Dinner > Pasta', 3], ['Dinner > Soup', 2], ['Breakfast', 4], ['Dinner > Pasta > Baked', 1]])
    const by = Object.fromEntries(t.map((n) => [n.name, n]))
    expect(by['Dinner'].count).toBe(6); expect(by['Dinner'].own).toBe(0); expect(by['Dinner'].real).toBe(false)
    expect(by['Dinner > Pasta'].count).toBe(4); expect(by['Dinner > Pasta'].own).toBe(3)
    expect(by['Breakfast'].count).toBe(4); expect(by['Breakfast'].depth).toBe(0)
    expect(by['Dinner > Pasta > Baked'].depth).toBe(2)
  })
  it('hides children until the parent is opened', () => {
    const t = categoryTree([['Dinner > Pasta', 1], ['Breakfast', 1]])
    expect(visibleNodes(t, new Set()).map((n) => n.name)).toEqual(['Breakfast', 'Dinner'])
    expect(visibleNodes(t, new Set(['Dinner'])).map((n) => n.name)).toEqual(['Breakfast', 'Dinner', 'Dinner > Pasta'])
    expect(hasChildren(t, 'Dinner')).toBe(true); expect(hasChildren(t, 'Breakfast')).toBe(false)
  })
  it('matches a recipe through its parent', () => {
    const r = { categories: ['Dinner > Pasta'] }
    expect(inCategory(r, 'Dinner')).toBe(true); expect(inCategory(r, 'Dinner > Pasta')).toBe(true); expect(inCategory(r, 'Breakfast')).toBe(false)
    expect(inCategory({}, 'Dinner')).toBe(false)
  })
  it('renames a branch and takes the children with it', () => {
    const all = ['Dinner', 'Dinner > Pasta', 'Dinner > Pasta > Baked', 'Breakfast']
    const m = renameMap(all, 'Dinner', 'Supper')
    expect([...m]).toEqual([['Dinner', 'Supper'], ['Dinner > Pasta', 'Supper > Pasta'], ['Dinner > Pasta > Baked', 'Supper > Pasta > Baked']])
    expect(applyRename(['Dinner > Pasta', 'Breakfast'], m)).toEqual(['Breakfast', 'Supper > Pasta'])
  })
  it('re-parents by renaming into a path', () => {
    expect([...renameMap(['Soup'], 'Soup', 'Dinner > Soup')]).toEqual([['Soup', 'Dinner > Soup']])
  })
  it('refuses to move a branch inside itself, or a no-op', () => {
    expect(renameMap(['Dinner', 'Dinner > Pasta'], 'Dinner', 'Dinner > Pasta > X').size).toBe(0)
    expect(renameMap(['Dinner'], 'Dinner', 'Dinner').size).toBe(0)
    expect(renameMap(['Dinner'], 'Dinner', '   ').size).toBe(0)
  })
  it('drops duplicates when two names collapse into one', () => {
    const m = renameMap(['A', 'B'], 'A', 'B')
    expect(applyRename(['A', 'B'], m)).toEqual(['B'])
  })
})

describe('reordering', () => {
  it('moves an item', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3])
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
    expect(moveItem([1, 2, 3], 0, 9)).toEqual([1, 2, 3])
  })
  it('works out which row the finger is over', () => {
    const geo = [{ top: 0, h: 50 }, { top: 50, h: 50 }, { top: 100, h: 50 }, { top: 150, h: 50 }]
    expect(dropIndex(geo, 0, 0)).toBe(0)
    expect(dropIndex(geo, 0, 60)).toBe(1)
    expect(dropIndex(geo, 0, 160)).toBe(3)
    expect(dropIndex(geo, 3, -160)).toBe(0)
    expect(dropIndex(geo, 2, -20)).toBe(2)
  })
})

describe('custom aisles and meal types', () => {
  it('falls back to the built-in lists', () => {
    expect(aisleList(null)).toEqual(AISLE_ORDER); expect(aisleList({ aisles: [] })).toEqual(AISLE_ORDER)
    expect(aisleList({ aisles: ['A', 'B'] })).toEqual(['A', 'B'])
    expect(mealTypeList({})).toEqual(MEAL_TYPES); expect(mealTypeList({ mealTypes: ['Tea'] })).toEqual(['Tea'])
  })
  it('never guesses an aisle that is not on the list', () => {
    expect(guessAisle('carrots')).toBe('Produce')
    expect(guessAisle('carrots', ['Pantry', 'Other'])).toBe('Other')
    expect(guessAisle('carrots', ['Pantry', 'Cold'])).toBe('Cold')
    expect(guessAisle('carrots', ['Produce', 'Other'])).toBe('Produce')
    expect(fallbackAisle(['A', 'B'])).toBe('B'); expect(fallbackAisle([])).toBe('Other')
  })
})

import { parseCommand, parseDuration, matchNamed, matchList, matchTab, confirmText, fmtDur, voiceCommand } from '../../src/lib/voice.js'

describe('spoken commands', () => {
  const ctx = {
    lists: [{ id: 'L1', name: 'Costco' }, { id: 'L2', name: 'Hardware store' }],
    recipes: [{ id: 'R1', name: 'Weeknight Turkey Chili' }, { id: 'R2', name: 'Baked Ziti' }, { id: 'R3', name: 'Turkey Sandwich' }],
  }
  it('adds to the default list unless another is named', () => {
    expect(parseCommand('add batteries', ctx)).toEqual({ kind: 'add', item: 'batteries', list: '' })
    expect(parseCommand('add butter to the groceries', ctx)).toEqual({ kind: 'add', item: 'butter', list: '' })
    expect(parseCommand('add two pounds of carrots to costco', ctx)).toEqual({ kind: 'add', item: 'two pounds of carrots', list: 'L1' })
    expect(parseCommand('add screws to the hardware list', ctx)).toEqual({ kind: 'add', item: 'screws', list: 'L2' })
    expect(parseCommand('put milk on the shopping list', ctx).list).toBe('')
  })
  it('says so rather than guessing when the list is not one of yours', () => {
    expect(parseCommand('add milk to the fish list', ctx)).toMatchObject({ kind: 'unclear' })
    expect(parseCommand('add milk to the fish list', ctx).why).toMatch(/fish/)
  })
  it('hears a duration', () => {
    expect(parseDuration('12 minutes')).toBe(720)
    expect(parseDuration('an hour and a half')).toBe(5400)
    expect(parseDuration('half an hour')).toBe(1800)
    expect(parseDuration('1 hour 30 minutes')).toBe(5400)
    expect(parseDuration('90 seconds')).toBe(90)
    expect(parseDuration('forty-five minutes')).toBe(2700)
    expect(parseDuration('soon')).toBe(null)
  })
  it('prefers a timer over an item that merely mentions one', () => {
    expect(parseCommand('start a 12 minute timer', ctx)).toEqual({ kind: 'timer', seconds: 720 })
    expect(parseCommand('add a 10 minute timer', ctx)).toEqual({ kind: 'timer', seconds: 600 })
    expect(parseCommand('set a timer', ctx)).toMatchObject({ kind: 'unclear' })
  })
  it('finds a recipe by part of its name, and admits when it cannot', () => {
    expect(parseCommand('cook the turkey chili', ctx)).toMatchObject({ kind: 'cook', id: 'R1' })
    expect(parseCommand('open baked ziti', ctx)).toMatchObject({ kind: 'open', id: 'R2' })
    expect(parseCommand('cook the lasagne', ctx)).toMatchObject({ kind: 'unclear' })
    // "turkey" alone matches two; the shorter name wins rather than the wrong one being chosen at random
    expect(matchNamed('turkey', ctx.recipes).name).toBe('Turkey Sandwich')
    expect(matchNamed('', ctx.recipes)).toBe(null)
    expect(matchNamed('turkey', [])).toBe(null)
  })
  it('goes to a tab by name', () => {
    expect(parseCommand('open the grocery list', ctx)).toEqual({ kind: 'tab', tab: 'groceries' })
    expect(parseCommand('show me the pantry', ctx)).toEqual({ kind: 'tab', tab: 'pantry' })
    expect(matchTab('meal plan')).toBe('planner'); expect(matchTab('nonsense')).toBe(null)
  })
  it('answers what is for dinner, and logs food', () => {
    expect(parseCommand('whats for dinner', ctx)).toEqual({ kind: 'plan' })
    expect(parseCommand('what am i cooking', ctx)).toEqual({ kind: 'plan' })
    expect(parseCommand('log a bowl of oatmeal', ctx)).toEqual({ kind: 'log', text: 'a bowl of oatmeal' })
    expect(parseCommand('i ate two eggs', ctx)).toEqual({ kind: 'log', text: 'two eggs' })
  })
  it('stops, and gives up honestly', () => {
    expect(parseCommand('stop', ctx)).toEqual({ kind: 'stop' })
    expect(parseCommand('mumble mumble', ctx)).toBe(null)
    expect(parseCommand('', ctx)).toBe(null)
    expect(parseCommand('   ', ctx)).toBe(null)
  })
  it('matches a list name on its own', () => {
    expect(matchList('', ctx.lists)).toEqual({ id: '' })
    expect(matchList('groceries', ctx.lists)).toEqual({ id: '' })
    expect(matchList('costco list', ctx.lists)).toEqual({ id: 'L1' })
    expect(matchList('hardware', ctx.lists)).toEqual({ id: 'L2' })
    expect(matchList('zoo', ctx.lists)).toEqual({ unknown: 'zoo' })
  })
  it('says back what it did', () => {
    expect(confirmText({ kind: 'add', item: 'butter' }, { name: 'butter' })).toBe('Added butter to groceries')
    expect(confirmText({ kind: 'add', item: 'screws' }, { name: 'screws', listName: 'Hardware store' })).toBe('Added screws to Hardware store')
    expect(confirmText({ kind: 'timer', seconds: 720 })).toBe('Timer set for 12 minutes')
    expect(fmtDur(45)).toBe('45 seconds'); expect(fmtDur(3600)).toBe('1 hour'); expect(fmtDur(5400)).toBe('1 hour 30 minutes')
  })
  it('leaves the cook-mode vocabulary alone', () => {
    expect(voiceCommand('okay next step')).toBe('next'); expect(voiceCommand('hello there')).toBe(null)
  })
})
