// Public calendar feed: GET /cardamom-ics?token=<household feed token>  ->  text/calendar
import { createClient } from 'jsr:@supabase/supabase-js@2'
const esc = (s: string) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
const day = (d: string, add = 0) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + add); return t.toISOString().slice(0, 10).replace(/-/g, '') }
Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!/^[a-f0-9]{32}$/.test(token)) return new Response('Not found', { status: 404 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: h } = await db.from('cardamom_households').select('id, name').eq('feed_token', token).maybeSingle()
  if (!h) return new Response('Not found', { status: 404 })
  const { data: meals } = await db.from('cardamom_items').select('id, data').eq('household_id', h.id).eq('kind', 'meal').eq('deleted', false).limit(2000)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cardamom//Meal Plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(h.name)} meals`]
  for (const m of meals || []) {
    const d = m.data || {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) continue
    out.push('BEGIN:VEVENT', `UID:${m.id}@cardamom`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(d.date)}`, `DTEND;VALUE=DATE:${day(d.date, 1)}`, `SUMMARY:${esc((d.type ? d.type + ': ' : '') + (d.title || 'Meal'))}`.slice(0, 200), 'TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  out.push('END:VCALENDAR')
  return new Response(out.join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'max-age=300' } })
})
