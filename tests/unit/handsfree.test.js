import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCommand } from '../../src/lib/voice.js'

// The regex is defined inside Voice.jsx, which imports React and cannot be loaded here.
// Lift it out of the source so the test checks the real thing rather than a copy of it.
const src = readFileSync(new URL('../../src/ui/Voice.jsx', import.meta.url), 'utf8')
const m = src.match(/const ENOUGH = (\/.*\/)\n/)
if (!m) throw new Error('ENOUGH not found in Voice.jsx')
const ENOUGH = eval(m[1])
const ending = (said) => {
  const t = said.trim().toLowerCase().replace(/[.!?]+$/, '')
  return parseCommand(said, { lists: [] })?.kind === 'stop' || ENOUGH.test(t)
}

describe('ending a hands-free session', () => {
  it('stops on the natural ways of saying you are finished', () => {
    for (const s of ['done', 'Done.', "that's all", 'that is it', 'thanks', 'finished', 'no more', 'stop', 'never mind'])
      expect(ending(s), s).toBe(true)
  })
  it('does not stop on something you want on the list', () => {
    for (const s of ['eggs', 'add milk', 'done pasta', 'all purpose flour', 'thank you cards'])
      expect(ending(s), s).toBe(false)
  })
})

describe('the endpoint is not taught session words', () => {
  it('"done" is not a stop command in the shared grammar', () => {
    expect(parseCommand('done', { lists: [] })).toBe(null)
    expect(parseCommand('stop', { lists: [] })).toMatchObject({ kind: 'stop' })
  })
})
