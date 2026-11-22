import { describe, it, expect } from 'vitest'
import { pantryUpserts } from '../../src/lib/grocery.js'

const startOfWeek = (d, first = 0) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() - first + 7) % 7)); return x }

describe('which day the week starts on', () => {
  // Wednesday 2026-11-25
  const wed = new Date('2026-11-25T12:00:00')
  it('Sunday is the default', () => {
    expect(startOfWeek(wed, 0).toDateString()).toBe(new Date('2026-11-22T12:00:00').toDateString())
  })
  it('Monday works for anyone who wants it', () => {
    expect(startOfWeek(wed, 1).toDateString()).toBe(new Date('2026-11-23T12:00:00').toDateString())
  })
  it('Saturday wraps backwards rather than forwards', () => {
    expect(startOfWeek(wed, 6).toDateString()).toBe(new Date('2026-11-21T12:00:00').toDateString())
  })
  it('a day that is already the first day stays put', () => {
    const sun = new Date('2026-11-22T12:00:00')
    expect(startOfWeek(sun, 0).toDateString()).toBe(sun.toDateString())
  })
})

describe('pantry remembers when things arrived', () => {
  it('stamps a brand new item with today', () => {
    const out = pantryUpserts([], [{ name: 'Rice', aisle: 'Pantry' }], '2026-11-22')
    expect(out[0]).toMatchObject({ kind: 'pantry', name: 'Rice', added: '2026-11-22' })
  })
  it('restarts the clock when something out of stock is bought again', () => {
    const pantry = [{ id: 'a', kind: 'pantry', name: 'Rice', inStock: false, added: '2026-01-01', seen: '2026-01-01' }]
    const out = pantryUpserts(pantry, [{ name: 'Rice' }], '2026-11-22')
    expect(out[0].added).toBe('2026-11-22')
    expect(out[0].inStock).toBe(true)
  })
  it('leaves the original date alone for something already in stock', () => {
    const pantry = [{ id: 'a', kind: 'pantry', name: 'Rice', inStock: true, added: '2026-01-01', seen: '2026-01-01' }]
    const out = pantryUpserts(pantry, [{ name: 'Rice' }], '2026-11-22')
    expect(out[0].added).toBe('2026-01-01')
  })
  it('gives an older item a date rather than leaving it blank forever', () => {
    const pantry = [{ id: 'a', kind: 'pantry', name: 'Rice', inStock: true, seen: '2026-01-01' }]
    const out = pantryUpserts(pantry, [{ name: 'Rice' }], '2026-11-22')
    expect(out[0].added).toBe('2026-11-22')
  })
})
