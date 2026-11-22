import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { clampQty, parseQty, stepQty } from '../lib/ingredients.js'

export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

const P = {
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11',
  cart: 'M3 4h2.5l2.2 10.5h10.2L20 7H7M9.5 19.5h.01M17 19.5h.01',
  calendar: 'M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4',
  jar: 'M8 3h8v3H8zM7 6h10l1.5 3v10a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V9zM5.5 13h13',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  back: 'M15 5l-7 7 7 7', close: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7.5',
  heart: 'M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  paste: 'M9 4h6v3H9zM7 5.5H5V20h14V5.5h-2M9 12h6M9 16h4', file: 'M7 3h7l4 4v14H7zM14 3v4h4',
  play: 'M8 5v14l11-7z', mic: 'M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4zM6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3',
  timer: 'M12 8v5l3 2M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 2.5h4',
  scale: 'M5 20V4M5 8h14M9 8v8M13 8v5M17 8v10', barcode: 'M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12',
  pan: 'M3 10h14a0 0 0 0 1 0 0v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM17 11.5h2.5a1.5 1.5 0 0 0 0-3H18',
  sparkle: 'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  sync: 'M5 12a7 7 0 0 1 12-4.9L19 9M19 4v5h-5M19 12a7 7 0 0 1-12 4.9L5 15M5 20v-5h5',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v6h14v-6', menu: 'M4 7h16M4 12h16M4 17h16', chevron: 'M9 5l7 7-7 7',
  pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7', users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M17.5 14.5A6 6 0 0 1 21 20',
  chart: 'M12 3a9 9 0 1 0 9 9h-9z M14.5 3.4A9 9 0 0 1 20.6 9.5h-6.1z', filter: 'M4 6h16l-6 7v6l-4-2v-4z', print: 'M7 8V4h10v4M7 17H4V9h16v8h-3M7 14h10v6H7z',
  minus: 'M5 12h14', sort: 'M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3',
  grip: 'M9.5 6h.01M9.5 12h.01M9.5 18h.01M14.5 6h.01M14.5 12h.01M14.5 18h.01', printer: 'M7 9V4h10v5M7 18H4V9h16v9h-3M7 14h10v6H7z',
  help: 'M9.2 9.3a2.9 2.9 0 1 1 4.6 2.4c-.9.7-1.8 1.3-1.8 2.6M12 17.6h.01', grid: 'M4 5h16v14H4zM4 9.7h16M4 14.3h16M9.3 5v14M14.7 5v14', expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bowl: 'M3.5 11h17a8.5 8.5 0 0 1-17 0zM9 8c0-1.6.8-2.3 1.6-3M13.5 8c0-2 1-2.8 1.9-4',
  leaf: 'M5 20c0-8.5 5.2-14.5 14.5-14.5C19.5 14 14.3 20 5 20zM5.5 19.5c1.8-5.4 4.8-8.6 8.5-10.6',
  alert: 'M12 4.5l8.5 15H3.5zM12 10v4M12 17.2h.01',
  info: 'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6zM12 11v5.5M12 7.8h.01',
}
/** "added today", "added 3 weeks ago" — how long something has been in the house. */
export function ageText(iso, verb = 'added') {
  if (!iso) return ''
  const days = Math.floor((new Date(today() + 'T12:00') - new Date(iso + 'T12:00')) / 86400000)
  if (!isFinite(days) || days < 0) return ''
  if (days === 0) return `${verb} today`
  if (days === 1) return `${verb} yesterday`
  if (days < 14) return `${verb} ${days} days ago`
  if (days < 60) return `${verb} ${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${verb} ${Math.round(days / 30)} months ago`
  const y = Math.floor(days / 365)
  return `${verb} over ${y} year${y > 1 ? 's' : ''} ago`
}

export function Icon({ name, size = 22, fill, ...rest }) {
  return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={P[name]} /></svg>
}

export function IconBtn({ icon, label, onClick, active, className = '', ...rest }) {
  return <button type="button" className={`iconbtn ${active ? 'on' : ''} ${className}`} aria-label={label} title={label} onClick={onClick} {...rest}><Icon name={icon} fill={active && icon === 'heart' ? 'currentColor' : undefined} /></button>
}

/** Full-screen page that slides in (recipe view, editor...). */
export function Page({ title, onBack, actions, children, className = '', footer }) {
  return (
    <section className={`page ${className}`} role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="bar">
        <IconBtn icon="back" label="Back" onClick={onBack} />
        <h2 className="bar-title">{title}</h2>
        <div className="bar-actions">{actions}</div>
      </header>
      <div className="page-body">{children}</div>
      {footer}
    </section>
  )
}

/** Bottom sheet. */
export function Sheet({ title, onClose, children, tall }) {
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className={`sheet ${tall ? 'tall' : ''}`} role="dialog" aria-label={title}>
        <header className="sheet-head"><h3>{title}</h3><IconBtn icon="close" label="Close" onClick={onClose} /></header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  )
}

export function Stars({ value = 0, onChange, size = 18 }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} disabled={!onChange} className={n <= value ? 'on' : ''} aria-label={`${n} stars`} onClick={() => onChange && onChange(n === value ? 0 : n)}>
          <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" /></svg>
        </button>
      ))}
    </span>
  )
}

export function Empty({ icon, title, children }) {
  return <div className="empty"><div className="empty-ico"><Icon name={icon} size={30} /></div><h3>{title}</h3><p>{children}</p></div>
}

export function Field({ label, children, hint }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>
}

export function AutoText({ value, onChange, rows = 3, ...rest }) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px' }, [value])
  return <textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
}

/** Round for display without trailing zeros: 1.3 -> "1.3", 0.25 -> "0.25", 2 -> "2". */
export const fmtQty = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000)

/**
 * A number you can either step or type. The +/- buttons walk a ladder of common amounts when
 * you are on one, and the number itself is an input, so an odd portion (1.3) is simply typed.
 * Junk and out-of-range input fall back to the last good value rather than poisoning the total.
 */
export function NumStepper({ value, onChange, unit, steps, min = 0.05, max = 999, label = 'Amount', hint }) {
  const [draft, setDraft] = useState(null)
  const [nudge, setNudge] = useState(0)
  const v = Number(value) || 0
  const bounds = { min, max }
  const emit = (n) => { setDraft(null); if (n != null && Math.abs(n - v) > 1e-9) { setNudge((x) => x + 1); onChange(n) } }
  const bump = (dir) => emit(stepQty(v, dir, steps, bounds))
  const commit = () => { if (draft == null) return; const n = parseQty(draft, bounds); setDraft(null); emit(n) }
  return (
    <div className="qty">
      <IconBtn icon="minus" label={`Less${unit ? ' ' + unit : ''}`} disabled={v <= min} onClick={() => bump(-1)} />
      <span className="qty-mid" key={nudge}>
        <input className="qty-input" type="text" inputMode="decimal" enterKeyHint="done" aria-label={label}
          value={draft ?? fmtQty(clampQty(v, bounds))}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            else if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
            else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1) }
            else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1) }
          }} />
        {unit && <small>{unit}{v === 1 ? '' : 's'}</small>}
      </span>
      <IconBtn icon="plus" label={`More${unit ? ' ' + unit : ''}`} disabled={v >= max} onClick={() => bump(1)} />
      {hint && <span className="qty-hint">{hint}</span>}
    </div>
  )
}

export function Busy({ label }) { return <div className="busy"><span className="spinner" />{label}</div> }

export function useWide() {
  const [w, setW] = useState(() => matchMedia('(min-width: 900px)').matches)
  useEffect(() => { const m = matchMedia('(min-width: 900px)'); const f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return w
}
export const fmtDate = (d) => d.toLocaleDateString('en-CA')
export const today = () => fmtDate(new Date())
