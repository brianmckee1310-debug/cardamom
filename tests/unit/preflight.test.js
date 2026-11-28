// Regressions found in the pre-flight check before the app's first real use.
import 'fake-indexeddb/auto' // store.js opens the database as it loads
import { describe, it, expect } from 'vitest'
import { mergeQty, mergeIntoList } from '../../src/lib/grocery.js'
import { tidy } from '../../src/store.js'

describe('quantities whose unit ends in "e"', () => {
  // "cloves" lost two letters to a bare /(es|s)$/ while "clove" lost none, so the two never
  // matched and the list showed "1 clove + 2 cloves" instead of adding them up.
  it('adds up units that pluralise with -s after an e', () => {
    expect(mergeQty('1 clove', '2 cloves')).toBe('3 cloves')
    expect(mergeQty('2 cloves', '1 clove')).toBe('3 cloves')
    expect(mergeQty('1 slice', '3 slices')).toBe('4 slices')
    expect(mergeQty('4 ounces', '2 ounces')).toBe('6 ounces')
    expect(mergeQty('1 package', '1 package')).toBe('2 packages')
  })
  it('still adds up the units that already worked', () => {
    expect(mergeQty('1 cup', '2 cups')).toBe('3 cups')
    expect(mergeQty('1 bunch', '1 bunch')).toBe('2 bunches')
    expect(mergeQty('2 cans', '1 can')).toBe('3 cans')
    expect(mergeQty('1 lb', '2 lb')).toBe('3 lb')
  })
  it('still refuses to add things that are not the same unit', () => {
    expect(mergeQty('1 cup', '2 cloves')).toBe('1 cup + 2 cloves')
    expect(mergeQty('1 slice', '2 sliced')).toBe('1 slice + 2 sliced')
  })
  it('combines the same ingredient arriving from two recipes', () => {
    const out = mergeIntoList([], [
      { kind: 'grocery', name: 'garlic', qty: '2 cloves', recipe: 'Tacos' },
      { kind: 'grocery', name: 'garlic', qty: '1 clove', recipe: 'Soup' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].qty).toBe('3 cloves')
    expect(out[0].recipe).toBe('Tacos, Soup')
  })
})

// A recipe whose categories arrived as a bare string used to crash every screen that showed
// it, which before the error boundary meant a white app.
describe('malformed records', () => {
  it('turns a string of categories back into a list', () => {
    expect(tidy({ kind: 'recipe', categories: 'Mexican, Seafood/Fish' }).categories).toEqual(['Mexican', 'Seafood/Fish'])
    expect(tidy({ kind: 'recipe', categories: 'Mexican' }).categories).toEqual(['Mexican'])
    expect(tidy({ kind: 'recipe', categories: 7 }).categories).toEqual([])
  })
  it('leaves good records exactly as they are', () => {
    const good = { kind: 'recipe', categories: ['A', 'B'] }
    expect(tidy(good)).toBe(good)
    const none = { kind: 'recipe', name: 'x' }
    expect(tidy(none)).toBe(none)
    const other = { kind: 'grocery', categories: 'nope' }
    expect(tidy(other)).toBe(other)
  })
})
