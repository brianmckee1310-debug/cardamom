import React, { useEffect, useState } from 'react'
import { useSettings, setSetting, useKind, saveItems, photosOf, allCategories, listKind } from '../store.js'
import { useApp, Page, Icon, Field, Busy } from './bits.jsx'
import { ROADMAP, VERSION } from '../roadmap.js'
import { sb, sbConfig, BUILT_IN, session, signIn, signUp, signOut, createHousehold, joinHousehold, findHousehold, syncNow, syncStatus, onSyncStatus, functionsUrl } from '../lib/sync.js'
import { DEFAULT_MODEL, recipeFromText } from '../lib/gemini.js'
import { writePaprikaFile } from '../lib/paprika.js'
import { buildIcs } from '../lib/ics.js'
import { download } from './RecipeView.jsx'

export function useSync() { const [s, setS] = useState(syncStatus()); useEffect(() => onSyncStatus(setS), []); return s }
const Row = ({ icon, title, sub, onClick, right }) => <li className="row"><button className="row-main" onClick={onClick}><span className="row-ico"><Icon name={icon} /></span><span className="row-text"><b>{title}</b>{sub && <small>{sub}</small>}</span>{right || <Icon name="chevron" size={18} />}</button></li>

export default function More() {
  const app = useApp()
  const s = useSettings()
  const sync = useSync()
  const recipes = useKind('recipe')
  const meals = useKind('meal')
  const [key, setKey] = useState(s.geminiKey || '')
  const [busy, setBusy] = useState('')
  const testKey = async () => {
    setBusy('Checking key'); await setSetting('geminiKey', key.trim())
    try { await recipeFromText({ key: key.trim(), model: s.geminiModel || DEFAULT_MODEL }, 'Toast\nIngredients\n1 slice bread\nDirections\nToast the bread.'); app.toast('Key works') } catch (e) { app.toast(e.message) }
    setBusy('')
  }
  const exportAll = async () => {
    setBusy('Building export')
    try {
      const entries = []
      for (const r of recipes) entries.push({ recipe: r, photos: await Promise.all((await photosOf(r.id)).map(async (p) => ({ idx: p.idx, bytes: new Uint8Array(await p.blob.arrayBuffer()) }))) })
      download(`Cardamom ${new Date().toLocaleDateString('en-CA')}.paprikarecipes`, new Blob([writePaprikaFile(entries)], { type: 'application/octet-stream' }))
    } catch (e) { app.toast('Export failed: ' + e.message) }
    setBusy('')
  }
  const feed = s.household?.feed_token && sbConfig().url ? `${functionsUrl('cardamom-ics')}?token=${s.household.feed_token}` : ''
  const syncSub = !sbConfig().url ? 'Not switched on yet' : !s.household ? 'Sign in to share your library' : sync.state === 'error' ? `Problem: ${sync.message}` : sync.state === 'syncing' ? 'Syncing' : sync.photosLeft ? `${sync.photosLeft} photos to go` : `${s.household.name} · up to date`
  return (
    <>
      <header className="top"><div className="top-title"><h1>More</h1></div></header>
      <div className="groups">
        {busy && <Busy label={busy} />}
        <ul className="list">
          <Row icon="menu" title="Menus" sub="Sets of recipes for occasions" onClick={() => app.push('menus')} />
          <Row icon="users" title="Household and sync" sub={syncSub} onClick={() => app.push('household')} />
          <Row icon="filter" title="Categories" sub={`${allCategories().length} categories`} onClick={() => app.push('categories')} />
        </ul>
        <h3 className="group-h">Your recipes</h3>
        <ul className="list">
          <Row icon="file" title="Import from Paprika" sub="Bring over a Paprika export file" onClick={() => app.push('import', { mode: 'paprika' })} />
          <Row icon="share" title="Export all recipes" sub={`${recipes.length} recipes, in Paprika's format`} onClick={exportAll} />
        </ul>
        <h3 className="group-h">Calendar</h3>
        <ul className="list">
          <Row icon="calendar" title="Download calendar file" sub="Add your meal plan to any calendar app" onClick={() => meals.length ? download('cardamom-meals.ics', buildIcs(meals), 'text/calendar') : app.toast('Plan a meal first')} />
          <Row icon="link" title="Copy live calendar link" sub={feed ? 'Subscribe once and it stays current' : 'Available once household sync is on'} onClick={async () => { if (!feed) return app.toast('Turn on household sync first'); await navigator.clipboard.writeText(feed); app.toast('Link copied. In Google Calendar: Other calendars, From URL.') }} />
        </ul>
        <h3 className="group-h">AI helper</h3>
        <div className="card">
          <Field label="Gemini key" hint="Free from aistudio.google.com (Get API key). Stored on this device only, so paste it on each phone."><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste key" autoComplete="off" spellCheck={false} /></Field>
          <div className="rowline"><button className="btn primary" disabled={!key.trim()} onClick={testKey}>Save and test</button>{s.geminiKey && <button className="btn" onClick={() => { setKey(''); setSetting('geminiKey', '') }}>Remove</button>}</div>
          <Field label="Model" hint="Leave as is unless Google retires it."><input value={s.geminiModel || DEFAULT_MODEL} onChange={(e) => setSetting('geminiModel', e.target.value.trim())} spellCheck={false} /></Field>
        </div>
        <h3 className="group-h">Appearance</h3>
        <div className="card"><div className="seg">{[['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => <button key={k} className={(s.theme || 'auto') === k ? 'on' : ''} onClick={() => setSetting('theme', k)}>{l}</button>)}</div></div>
        <ul className="list"><Row icon="sparkle" title="Roadmap" sub={`Version ${VERSION}`} onClick={() => app.push('roadmap')} /></ul>
      </div>
    </>
  )
}

/** Sign-in and join errors come back in the service's own words; say them in ours. */
function plainly(x) {
  const m = (x?.message || String(x) || '').trim()
  const low = m.toLowerCase()
  if (/invalid login credentials/.test(low)) return 'That email and password do not match an account. Check the password, or use Create account if this is your first time.'
  if (/email not confirmed/.test(low)) return 'This account still needs confirming. Open the email from Supabase, tap the link, then sign in here.'
  if (/already registered|already been registered/.test(low)) return 'There is already an account with that email. Sign in instead.'
  if (/password should be|at least 6/.test(low)) return 'The password needs to be at least 6 characters.'
  if (/rate limit|too many/.test(low)) return 'Too many tries in a row. Wait a minute and try again.'
  if (/failed to fetch|network/.test(low)) return 'Could not reach the server. Check the connection and try again.'
  if (/no household|not found|invalid code/.test(low)) return 'No household matches that code. Codes are 8 characters — check it against the other phone.'
  return m || 'Something went wrong.'
}

export function Household() {
  const app = useApp()
  const s = useSettings()
  const sync = useSync()
  const [sess, setSess] = useState(undefined)
  const [f, setF] = useState({ email: '', password: '', name: 'Our kitchen', code: '', url: s.sbUrl || '', key: s.sbKey || '' })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const up = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const refresh = async () => { try { const x = await session(); setSess(x); if (x && !s.household) await findHousehold() } catch (e) { setSess(null) } }
  useEffect(() => { refresh() }, [s.sbUrl, s.sbKey])
  const run = (label, fn) => async (e) => { e?.preventDefault?.(); setBusy(label); setErr(''); setNote(''); try { await fn() } catch (x) { setErr(plainly(x)) } setBusy(''); refresh() }
  const configured = !!sbConfig().url
  return (
    <Page title="Household and sync" onBack={app.back}>
      <div className="form">
        {err && <p className="banner err"><Icon name="alert" size={16} />{err}</p>}
        {note && <p className="banner"><Icon name="info" size={16} />{note}</p>}
        {busy && <Busy label={busy} />}
        {!configured ? (
          <>
            <p className="lead">Sync is not switched on yet.</p>
            <p className="muted">Everything works on this device without it. Once the shared database is connected, both of you sign in here and the library, lists and planner stay in step.</p>
            {!BUILT_IN.url && <details><summary>Connect a database by hand</summary>
              <Field label="Supabase project URL"><input value={f.url} onChange={up('url')} placeholder="https://xxxx.supabase.co" /></Field>
              <Field label="Publishable (anon) key"><input value={f.key} onChange={up('key')} /></Field>
              <button className="btn primary" disabled={!/^https:\/\/.+/.test(f.url) || f.key.length < 20} onClick={async () => { await setSetting('sbUrl', f.url.trim().replace(/\/$/, '')); await setSetting('sbKey', f.key.trim()) }}>Connect</button>
            </details>}
          </>
        ) : sess === undefined ? <Busy label="Checking" /> : !sess ? (
          <form onSubmit={run('Signing in', () => signIn(f.email.trim(), f.password))}>
            <p className="lead">Sign in to share one library.</p>
            <p className="muted small nudge">New here? Fill these in and tap <b>Create account</b> — then join the household with the 8-character code from the other phone. The recipes, lists and planner stay in step from then on.</p>
            <Field label="Email"><input type="email" value={f.email} onChange={up('email')} autoComplete="email" inputMode="email" /></Field>
            <Field label="Password" hint="At least 6 characters."><input type="password" value={f.password} onChange={up('password')} autoComplete="current-password" /></Field>
            <div className="rowline"><button className="btn primary grow" disabled={!f.email || f.password.length < 6}>Sign in</button><button type="button" className="btn" disabled={!f.email || f.password.length < 6} onClick={run('Creating account', async () => { const inNow = await signUp(f.email.trim(), f.password); if (!inNow) setNote('Account created. Open the confirmation email, tap the link, then sign in here.') })}>Create account</button></div>
          </form>
        ) : !s.household ? (
          <>
            <p className="lead">Signed in as {sess.user.email}</p>
            <form className="card" onSubmit={run('Creating', () => createHousehold(f.name).then(syncNow))}><Field label="Start a household" hint="Do this on the phone that already has the recipes."><input value={f.name} onChange={up('name')} /></Field><button className="btn primary">Create</button></form>
            <form className="card" onSubmit={run('Joining', () => joinHousehold(f.code).then(syncNow))}><Field label="Or join with a code" hint="The code is on the other phone, under More, Household and sync."><input value={f.code} onChange={up('code')} placeholder="8 letters and numbers" autoCapitalize="characters" autoCorrect="off" spellCheck="false" /></Field><button className="btn primary" disabled={f.code.trim().length < 6}>Join</button></form>
            <button className="btn" onClick={run('Signing out', signOut)}>Sign out</button>
          </>
        ) : (
          <>
            <p className="lead">{s.household.name}</p>
            <div className="card"><span className="field-label">Invite code</span><div className="rowline"><b className="code">{s.household.join_code}</b><button className="btn small" onClick={async () => { await navigator.clipboard.writeText(s.household.join_code); app.toast('Code copied') }}>Copy</button></div><span className="field-hint">The other person creates an account here, then joins with this code.</span></div>
            <div className="card"><span className="field-label">Status</span><p>{sync.state === 'error' ? `Problem: ${sync.message}` : sync.state === 'syncing' ? 'Syncing now' : sync.last ? `Up to date as of ${sync.last.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for first sync'}{sync.photosLeft ? `. ${sync.photosLeft} photos still moving.` : ''}</p><button className="btn" onClick={() => syncNow()}><Icon name="sync" size={18} />Sync now</button></div>
            <p className="muted">Signed in as {sess.user.email}</p>
            <button className="btn" onClick={run('Signing out', signOut)}>Sign out</button>
          </>
        )}
      </div>
    </Page>
  )
}

export function Categories() {
  const app = useApp()
  const s = useSettings()
  useKind('recipe')
  const cats = allCategories()
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState('')
  const rename = async (from, to) => {
    to = to.trim(); setEditing(null)
    if (!to || to === from) return
    const hit = listKind('recipe').filter((r) => (r.categories || []).includes(from))
    await saveItems(hit.map((r) => ({ ...r, categories: [...new Set(r.categories.map((c) => (c === from ? to : c)))].sort((a, b) => a.localeCompare(b)) })))
    await setSetting('extraCategories', (s.extraCategories || []).map((c) => (c === from ? to : c)))
    app.toast(`Renamed to ${to}`)
  }
  const remove = async (c) => {
    const hit = listKind('recipe').filter((r) => (r.categories || []).includes(c))
    const extras = s.extraCategories || []
    await saveItems(hit.map((r) => ({ ...r, categories: r.categories.filter((x) => x !== c) })))
    await setSetting('extraCategories', extras.filter((x) => x !== c))
    app.toast(`Removed ${c} from ${hit.length} recipes`, { undo: async () => { await saveItems(hit); await setSetting('extraCategories', extras) } })
  }
  return (
    <Page title="Categories" onBack={app.back}>
      <form className="search add" onSubmit={async (e) => { e.preventDefault(); if (fresh.trim()) { await setSetting('extraCategories', [...new Set([...(s.extraCategories || []), fresh.trim()])]); setFresh('') } }}><Icon name="plus" size={18} /><input value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="New category" aria-label="New category" />{fresh.trim() && <button className="btn small primary">Add</button>}</form>
      <ul className="list">
        {cats.map(([c, n]) => editing === c ? (
          <li key={c} className="row"><form className="rowline pad" onSubmit={(e) => { e.preventDefault(); rename(c, name) }}><input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Category name" /><button className="btn primary small">Save</button><button type="button" className="btn small" onClick={() => setEditing(null)}>Cancel</button></form></li>
        ) : (
          <li key={c} className="row"><button className="row-main" onClick={() => { setEditing(c); setName(c) }}><span className="row-text"><b>{c}</b><small>{n} recipes</small></span></button><button className="iconbtn" aria-label={`Delete ${c}`} onClick={() => remove(c)}><Icon name="trash" /></button></li>
        ))}
      </ul>
    </Page>
  )
}

export function Roadmap() {
  const app = useApp()
  return (
    <Page title="Roadmap" onBack={app.back}>
      <ol className="roadmap">{ROADMAP.map((p) => <li key={p.n} className={p.status}><span className="tag">{p.status === 'done' ? 'Done' : p.status === 'next' ? 'Next' : 'Later'}</span><b>{p.n}. {p.name}</b><p>{p.items}</p>{p.needs && <small>Needs: {p.needs}</small>}</li>)}</ol>
    </Page>
  )
}
