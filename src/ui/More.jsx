import React, { useEffect, useState } from 'react'
import { useSettings, setSetting, useKind, saveItems, photosOf, allCategories, listKind, useStore, restoreItem } from '../store.js'
import { useApp, Page, Icon, Field, Busy, Empty } from './bits.jsx'
import { ROADMAP, VERSION } from '../roadmap.js'
import { sb, sbConfig, BUILT_IN, session, signIn, signUp, signOut, createHousehold, joinHousehold, findHousehold, syncNow, syncStatus, onSyncStatus, functionsUrl } from '../lib/sync.js'
import { DEFAULT_MODEL, recipeFromText } from '../lib/gemini.js'
import { writePaprikaFile } from '../lib/paprika.js'
import { buildIcs, mealTypeList, MEAL_TYPES } from '../lib/ics.js'
import { aisleList, AISLE_ORDER, fallbackAisle } from '../lib/ingredients.js'
import DragList from './DragList.jsx'
import { categoryTree, visibleNodes, hasChildren, renameMap, applyRename, normalizeCat, isUnder } from '../lib/categories.js'
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
          <Row icon="trash" title="Recently deleted" sub="Restore a recipe" onClick={() => app.push('trash')} />
          <Row icon="grid" title="Aisles" sub={`${aisleList(s).length} sections, in shop order`} onClick={() => app.push('aisles')} />
          <Row icon="calendar" title="Meal types" sub={mealTypeList(s).join(', ')} onClick={() => app.push('mealTypes')} />
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
        <h3 className="group-h">Hands free</h3>
        <ul className="list">
          <Row icon="mic" title="Add by voice" sub={s.household ? 'Siri and other shortcuts, without opening the app' : 'Available once household sync is on'} onClick={() => s.household ? app.push('voiceAdding') : app.toast('Turn on household sync first')} />
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

/**
 * Per-device tokens for the voice endpoint. One per phone rather than one per household, so a
 * lost phone costs you one revoke instead of re-pasting a new secret everywhere.
 */
export function VoiceAdding() {
  const app = useApp()
  const s = useSettings()
  const [rows, setRows] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState('')
  const [fresh, setFresh] = useState('')

  const load = async () => {
    const c = sb()
    if (!c || !s.household) return setRows([])
    const { data, error } = await c.from('cardamom_tokens').select('token, label, created_at, last_used_at').eq('household_id', s.household.id).order('created_at')
    if (error) { app.toast(plainly(error.message)); return setRows([]) }
    setRows(data || [])
  }
  useEffect(() => { load() }, [s.household?.id])

  const urlFor = (t) => `${functionsUrl('cardamom-add')}?token=${t}&text=`

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy('Making a token')
    const { data, error } = await sb().from('cardamom_tokens').insert({ household_id: s.household.id, label: name.trim() }).select('token, label, created_at, last_used_at').single()
    setBusy('')
    if (error) return app.toast(plainly(error.message))
    setName(''); setFresh(data.token); setRows((r) => [...(r || []), data])
    try { await navigator.clipboard.writeText(urlFor(data.token)); app.toast('Token made, and the link is copied') } catch { app.toast('Token made') }
  }

  const revoke = async (t) => {
    setBusy('Revoking')
    const { error } = await sb().from('cardamom_tokens').delete().eq('token', t.token)
    setBusy('')
    if (error) return app.toast(plainly(error.message))
    setRows((r) => r.filter((x) => x.token !== t.token))
    app.toast(`${t.label} can no longer add to your lists`)
  }

  const when = (iso) => {
    if (!iso) return 'never used'
    const mins = Math.round((Date.now() - new Date(iso)) / 60000)
    if (mins < 1) return 'used just now'
    if (mins < 60) return `used ${mins} minute${mins > 1 ? 's' : ''} ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `used ${hrs} hour${hrs > 1 ? 's' : ''} ago`
    return `used ${new Date(iso).toLocaleDateString()}`
  }

  return (
    <Page title="Add by voice" onBack={app.back}>
      {busy && <Busy label={busy} />}
      <p className="lead">Say an item without opening the app. Each phone gets its own link; revoking one leaves the others working.</p>
      <div className="card">
        <form onSubmit={create}>
          <Field label="New token" hint="Name it after the phone it is going on, so you know which one to revoke later."><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brian's phone" /></Field>
          <button className="btn primary block" disabled={!name.trim()}>Make a token and copy the link</button>
        </form>
      </div>

      {rows === null ? <Busy label="Loading" /> : !rows.length ? (
        <Empty icon="mic" title="No tokens yet">Make one above, then paste the link into a Shortcut.</Empty>
      ) : (
        <ul className="list tokens">
          {rows.map((t) => (
            <li key={t.token} className={`row token-row ${fresh === t.token ? 'just-made' : ''}`}>
              <div className="row-text">
                <b>{t.label}</b>
                <small>{when(t.last_used_at)}</small>
              </div>
              <div className="rowline">
                <button className="btn small" onClick={async () => { await navigator.clipboard.writeText(urlFor(t.token)); app.toast('Link copied') }}>Copy link</button>
                <button className="btn small danger" onClick={() => revoke(t)}>Revoke</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="group-h">Setting it up</h3>
      <div className="card prose">
        <p><b>iPhone.</b> Shortcuts app, new shortcut, two actions: <i>Dictate Text</i>, then <i>Get Contents of URL</i>. Paste the copied link into the URL and drop the Dictated Text onto the end of it. Name it &ldquo;Add to Cardamom&rdquo;. Then say &ldquo;Hey Siri, add to Cardamom&rdquo;.</p>
        <p><b>Android.</b> Anything that can open a web address works &mdash; a home screen shortcut, Samsung&rsquo;s Modes and Routines, HTTP Shortcuts, Tasker. Hands-free on Android is still being worked out; see the roadmap.</p>
        <p><b>What it understands.</b> &ldquo;Eggs&rdquo; on its own, or &ldquo;add two pounds of carrots&rdquo;, or &ldquo;add nails to the hardware store&rdquo;. No list named means the grocery list. It combines with anything already on that list rather than adding a second line.</p>
        <p className="muted small">Anyone holding the link can add to your lists, so treat it like a key. It cannot read your recipes or change anything else.</p>
      </div>
    </Page>
  )
}

export function Categories() {
  const app = useApp()
  const s = useSettings()
  useKind('recipe')
  const nodes = categoryTree(allCategories())
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const shown = visibleNodes(nodes, open)
  const toggle = (n) => setOpen((o) => { const x = new Set(o); x.has(n) ? x.delete(n) : x.add(n); return x })

  /** Renaming a branch takes its children with it: "Dinner" -> "Supper" moves "Dinner > Pasta" too. */
  const rename = async (from, to) => {
    setEditing(null)
    const map = renameMap([...nodes.map((n) => n.name), ...(s.extraCategories || [])], from, to)
    if (!map.size) { if (normalizeCat(to) && normalizeCat(to) !== normalizeCat(from)) app.toast('A category cannot be moved inside itself'); return }
    const hit = listKind('recipe').filter((r) => (r.categories || []).some((c) => map.has(normalizeCat(c))))
    await saveItems(hit.map((r) => ({ ...r, categories: applyRename(r.categories, map) })))
    await setSetting('extraCategories', (s.extraCategories || []).map((c) => map.get(normalizeCat(c)) || c))
    app.toast(`Renamed${hit.length ? ` on ${hit.length} recipe${hit.length === 1 ? '' : 's'}` : ''}`)
  }
  const remove = async (c) => {
    const under = nodes.filter((n) => isUnder(n.name, c)).map((n) => n.name)
    const hit = listKind('recipe').filter((r) => (r.categories || []).some((x) => under.includes(normalizeCat(x))))
    const extras = s.extraCategories || []
    await saveItems(hit.map((r) => ({ ...r, categories: (r.categories || []).filter((x) => !under.includes(normalizeCat(x))) })))
    await setSetting('extraCategories', extras.filter((x) => !under.includes(normalizeCat(x))))
    app.toast(`Removed from ${hit.length} recipe${hit.length === 1 ? '' : 's'}`, { undo: async () => { await saveItems(hit); await setSetting('extraCategories', extras) } })
  }
  return (
    <Page title="Categories" onBack={app.back}>
      <p className="hint">Use <b>Parent &gt; Child</b> to nest one inside another — rename a category to <i>Dinner &gt; Pasta</i> and it moves under Dinner. Choosing a parent shows everything beneath it.</p>
      <form className="search add" onSubmit={async (e) => { e.preventDefault(); const v = normalizeCat(fresh); if (v) { await setSetting('extraCategories', [...new Set([...(s.extraCategories || []), v])]); setFresh('') } }}><Icon name="plus" size={18} /><input value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="New category, or Parent > Child" aria-label="New category" />{fresh.trim() && <button className="btn small primary">Add</button>}</form>
      <ul className="list">
        {shown.map((n) => editing === n.name ? (
          <li key={n.name} className="row"><form className="rowline pad" onSubmit={(e) => { e.preventDefault(); rename(n.name, name) }}><input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Category name" /><button className="btn primary small">Save</button><button type="button" className="btn small" onClick={() => setEditing(null)}>Cancel</button></form></li>
        ) : (
          <li key={n.name} className="row" style={{ paddingLeft: n.depth * 18 }}>
            {hasChildren(nodes, n.name)
              ? <button className="iconbtn twist" aria-label={`${open.has(n.name) ? 'Collapse' : 'Expand'} ${n.label}`} aria-expanded={open.has(n.name)} onClick={() => toggle(n.name)}><Icon name="chevron" size={15} className={`ico turn ${open.has(n.name) ? 'down' : ''}`} /></button>
              : <span className="twist" />}
            <button className="row-main" onClick={() => { setEditing(n.name); setName(n.name) }}><span className="row-text"><b>{n.label}</b><small>{n.count} recipe{n.count === 1 ? '' : 's'}{hasChildren(nodes, n.name) ? ', including below' : ''}</small></span></button>
            <button className="iconbtn" aria-label={`Delete ${n.label}`} onClick={() => remove(n.name)}><Icon name="trash" /></button>
          </li>
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

/** Deleted recipes are only hidden, so they can come back. */
export function Trash() {
  const app = useApp()
  const store = useStore()
  const gone = [...store.items.values()].filter((i) => i.kind === 'recipe' && i.deleted).sort((a, b) => (b.u || '').localeCompare(a.u || ''))
  return (
    <Page title="Recently deleted" onBack={app.back}>
      {!gone.length ? <Empty icon="trash" title="Nothing deleted">Recipes you delete wait here.</Empty> : (
        <ul className="list">{gone.map((r) => <li key={r.id} className="row"><span className="row-main static"><span className="row-text"><b>{r.name}</b><small>{r.source || ''}</small></span></span><button className="btn small" onClick={async () => { await restoreItem(r.id); app.toast(`${r.name} restored`) }}>Restore</button></li>)}</ul>
      )}
    </Page>
  )
}

/**
 * A reorderable, renameable list kept in settings. Used for grocery aisles and meal types,
 * which behave the same way: drag to order, tap to rename, and renaming has to carry the
 * items that already refer to the old name.
 */
function EditableList({ title, intro, settingKey, fallback, addLabel, onRename, onRemove, removeWarning }) {
  const app = useApp()
  const s = useSettings()
  const list = s[settingKey]?.length ? s[settingKey] : fallback
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState('')
  const save = async (next) => setSetting(settingKey, next)
  const rename = async (from, to) => {
    to = to.trim(); setEditing(null)
    if (!to || to === from || list.includes(to)) return
    await save(list.map((x) => (x === from ? to : x)))
    const n = await onRename(from, to)
    app.toast(n ? `Renamed, and ${n} item${n === 1 ? '' : 's'} moved with it` : `Renamed to ${to}`)
  }
  const remove = async (x) => {
    if (list.length < 2) return
    const next = list.filter((y) => y !== x)
    await save(next)
    const n = await onRemove(x, next)
    app.toast(n ? `${x} removed, ${n} item${n === 1 ? '' : 's'} moved` : `${x} removed`)
  }
  return (
    <Page title={title} onBack={app.back}>
      <p className="hint">{intro}</p>
      <form className="search add" onSubmit={async (e) => { e.preventDefault(); const v = fresh.trim(); if (v && !list.includes(v)) { await save([...list, v]); setFresh('') } }}>
        <Icon name="plus" size={18} /><input value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder={addLabel} aria-label={addLabel} />{fresh.trim() && <button className="btn small primary">Add</button>}
      </form>
      <DragList items={list} keyOf={(x) => x} labelOf={(x) => x} onReorder={save} renderItem={(x) => (
        editing === x
          ? <form className="rowline pad" onSubmit={(e) => { e.preventDefault(); rename(x, name) }}><input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Name" /><button className="btn primary small">Save</button><button type="button" className="btn small" onClick={() => setEditing(null)}>Cancel</button></form>
          : <><button className="row-main" onClick={() => { setEditing(x); setName(x) }}><span className="row-text"><b>{x}</b></span></button>{list.length > 1 && <button className="iconbtn" aria-label={`Remove ${x}`} onClick={() => remove(x)}><Icon name="trash" /></button>}</>
      )} />
      <p className="muted small pad">{removeWarning}</p>
      {s[settingKey]?.length > 0 && <button className="btn block" onClick={() => save(null)}>Back to the built-in list</button>}
    </Page>
  )
}

export function Aisles() {
  const move = async (from, to) => {
    const hit = [...listKind('grocery'), ...listKind('pantry')].filter((i) => (i.aisle || 'Other') === from)
    if (hit.length) await saveItems(hit.map((i) => ({ ...i, aisle: to })))
    return hit.length
  }
  return <EditableList title="Aisles" settingKey="aisles" fallback={AISLE_ORDER} addLabel="New aisle"
    intro="The order here is the order your grocery list is grouped in, so put them in the order you walk the shop."
    onRename={move} onRemove={(x, next) => move(x, fallbackAisle(next))}
    removeWarning="Removing an aisle moves anything in it to the last aisle on the list. Nothing is deleted." />
}

export function MealTypes() {
  const move = async (from, to) => {
    const hit = listKind('meal').filter((m) => m.type === from)
    if (hit.length) await saveItems(hit.map((m) => ({ ...m, type: to })))
    return hit.length
  }
  return <EditableList title="Meal types" settingKey="mealTypes" fallback={MEAL_TYPES} addLabel="New meal type"
    intro="These are the slots on each day of the planner, shown in this order."
    onRename={move} onRemove={(x, next) => move(x, next[next.length - 1])}
    removeWarning="Removing a meal type moves anything planned under it to the last type on the list." />
}
