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
