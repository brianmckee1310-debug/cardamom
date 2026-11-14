// Fetches a public web page for a signed-in Cardamom user (browsers cannot read other sites directly).
import { createClient } from 'jsr:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const privateHost = (h: string) => /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[|.*\.internal$|.*\.local$)/i.test(h) || /^\d+$/.test(h)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } })
  const { data: { user } } = await db.auth.getUser()
  if (!user) return new Response('Sign in first', { status: 401, headers: cors })
  const { data: member } = await db.from('cardamom_members').select('household_id').limit(1)
  if (!member?.length) return new Response('Not a Cardamom member', { status: 403, headers: cors })
  let target: URL
  try { target = new URL((await req.json()).url) } catch { return new Response('Bad url', { status: 400, headers: cors }) }
  if (!/^https?:$/.test(target.protocol) || privateHost(target.hostname)) return new Response('Bad url', { status: 400, headers: cors })
  const binary = new URL(req.url).searchParams.get('as') === 'image'
  try {
    const res = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept': binary ? 'image/*' : 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(15000) })
    const type = res.headers.get('content-type') || ''
    if (binary) {
      if (!type.startsWith('image/')) return new Response('Not an image', { status: 415, headers: cors })
      const buf = await res.arrayBuffer()
      if (buf.byteLength > 8_000_000) return new Response('Too large', { status: 413, headers: cors })
      return new Response(buf, { headers: { ...cors, 'Content-Type': type } })
    }
    const text = (await res.text()).slice(0, 3_000_000)
    return new Response(text, { status: res.ok ? 200 : 502, headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (e) {
    return new Response('Fetch failed: ' + (e as Error).message, { status: 502, headers: cors })
  }
})
