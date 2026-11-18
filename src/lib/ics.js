// Build an iCalendar file from meal-plan entries. Kept dependency-free so the edge function can mirror it.
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
const fold = (line) => { const out = []; while (line.length > 73) { out.push(line.slice(0, 73)); line = ' ' + line.slice(73) } out.push(line); return out.join('\r\n') }
const nextDay = (d) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10) }
export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
/** The meal types in use, which the planner lets you rename and reorder. */
export const mealTypeList = (settings) => (settings?.mealTypes?.length ? settings.mealTypes : MEAL_TYPES)
export function buildIcs(meals, { name = 'Cardamom meals', stamp = new Date() } = {}) {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cardamom//Meal Plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`]
  for (const m of meals) {
    if (!m.date || m.deleted) continue
    lines.push('BEGIN:VEVENT', `UID:${m.id}@cardamom`, `DTSTAMP:${dt}`, `DTSTART;VALUE=DATE:${m.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(m.date).replace(/-/g, '')}`,
      fold(`SUMMARY:${esc((m.type ? m.type + ': ' : '') + (m.title || 'Meal'))}`), 'TRANSP:TRANSPARENT')
    if (m.note) lines.push(fold(`DESCRIPTION:${esc(m.note)}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
