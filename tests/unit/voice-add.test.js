import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCommand, matchList, spokenNumbers } from '../../src/lib/voice.js'
import { quickItem, mergeIntoList } from '../../src/lib/grocery.js'

const LISTS = [
  { id: 'l1', name: 'Hardware store' },
  { id: 'l2', name: 'Home goods' },
  { id: 'l3', name: 'Gifts, wants, non-essentials' },
]

describe('spoken numbers', () => {
  it('turns a leading number word into a quantity when a unit follows', () => {
    expect(spokenNumbers('two pounds of carrots')).toBe('2 pounds of carrots')
    expect(spokenNumbers('three cans of beans')).toBe('3 cans of beans')
    expect(spokenNumbers('a dozen eggs')).toBe('a dozen eggs')
  })
  it('leaves product names alone', () => {
    expect(spokenNumbers('four cheese pizza')).toBe('four cheese pizza')
    expect(spokenNumbers('two buck chuck')).toBe('two buck chuck')
    expect(spokenNumbers('eggs')).toBe('eggs')
  })
  it('feeds the quantity parser, so the name is the thing itself', () => {
    const it1 = quickItem(spokenNumbers('two pounds of carrots'), 'grocery')
    expect(it1.name).toBe('carrots')
    expect(it1.qty).toBe('2 pounds')
    expect(it1.aisle).toBe('Produce')
  })
})

describe('what the voice endpoint accepts', () => {
  it('understands a full sentence naming a list', () => {
    const cmd = parseCommand('add nails to the hardware store', { lists: LISTS })
    expect(cmd).toMatchObject({ kind: 'add', item: 'nails', list: 'l1' })
  })
  it('sends an unnamed list to groceries', () => {
    expect(parseCommand('add milk', { lists: LISTS })).toMatchObject({ kind: 'add', item: 'milk', list: '' })
    expect(parseCommand('add milk to the grocery list', { lists: LISTS })).toMatchObject({ list: '' })
  })
  it('says so rather than guessing when the list is not one of ours', () => {
    const cmd = parseCommand('add a drill to the garage', { lists: LISTS })
    expect(cmd.kind).toBe('unclear')
    expect(cmd.why).toMatch(/garage/)
  })
  it('matches a list on part of its name, the way it gets said out loud', () => {
    expect(matchList('gifts', LISTS)).toEqual({ id: 'l3' })
    expect(matchList('home goods list', LISTS)).toEqual({ id: 'l2' })
  })
  it('drops the article, so a hammer is a hammer', () => {
    expect(parseCommand('add a hammer to hardware', { lists: LISTS })).toMatchObject({ item: 'hammer', list: 'l1' })
    expect(parseCommand('add some milk', { lists: LISTS })).toMatchObject({ item: 'milk' })
    expect(parseCommand('add avocados', { lists: LISTS })).toMatchObject({ item: 'avocados' })
  })
  it('does not read hammer as ham', () => {
    expect(quickItem('hammer', 'grocery').aisle).toBe('Other')
    expect(quickItem('hamper', 'grocery').aisle).toBe('Other')
    expect(quickItem('ham', 'grocery').aisle).toBe('Meat & Seafood')
    expect(quickItem('hams', 'grocery').aisle).toBe('Meat & Seafood')
  })
  it('combines with what is already on the list instead of adding a second line', () => {
    const existing = [{ id: 'a', kind: 'grocery', name: 'Eggs', qty: '', done: false, list: undefined }]
    const out = mergeIntoList(existing, [{ ...quickItem('eggs', 'grocery'), done: false }])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })
  it('does not combine with something already ticked off', () => {
    const existing = [{ id: 'a', kind: 'grocery', name: 'Eggs', qty: '', done: true }]
    const out = mergeIntoList(existing, [{ ...quickItem('eggs', 'grocery'), done: false }])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBeUndefined()
  })
})

// The edge function cannot import from src/, so it ships its own copies. If they drift, the
// endpoint quietly stops behaving like the app. Catch that here rather than in the kitchen.
describe('the deployed copies match the app', () => {
  for (const f of ['voice.js', 'grocery.js', 'ingredients.js']) {
    it(`${f} is identical under supabase/functions/cardamom-add/lib/`, () => {
      const a = readFileSync(new URL(`../../src/lib/${f}`, import.meta.url), 'utf8')
      const b = readFileSync(new URL(`../../supabase/functions/cardamom-add/lib/${f}`, import.meta.url), 'utf8')
      expect(b).toBe(a)
    })
  }
})
