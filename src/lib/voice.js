/** What a spoken phrase means. Exported for tests. */
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
