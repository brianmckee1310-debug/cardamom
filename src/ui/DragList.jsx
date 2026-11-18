import React, { useRef, useState } from 'react'
import { Icon } from './bits.jsx'

/** Move one item of an array to another index. Pure, so the reordering itself is testable. */
export function moveItem(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const out = [...arr]
  out.splice(to, 0, out.splice(from, 1)[0])
  return out
}

/** Which row the dragged one is over now, given where every row started and how far it moved. */
export function dropIndex(geo, from, dy) {
  const mid = geo[from].top + geo[from].h / 2 + dy
  let to = from
  if (dy < 0) { for (let i = 0; i < from; i++) if (mid < geo[i].top + geo[i].h) { to = i; break } }
  else { for (let i = geo.length - 1; i > from; i--) if (mid > geo[i].top) { to = i; break } }
  return to
}

/**
 * A list whose rows can be dragged by their handle. Touch-first: the handle takes the pointer
 * so the page does not scroll under the finger. The handle is also a real button, so the
 * arrow keys move a row for anyone not dragging.
 */
export default function DragList({ items, onReorder, renderItem, className = '', itemClass = '', rowClass = () => '', keyOf = (x) => x.id ?? x, labelOf = (x) => x.name ?? String(x) }) {
  const ref = useRef(null)
  const geo = useRef([])
  const [drag, setDrag] = useState(null)

  const down = (from) => (e) => {
    if (items.length < 2 || e.button > 0) return
    geo.current = [...ref.current.children].map((r) => { const b = r.getBoundingClientRect(); return { top: b.top, h: b.height } })
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ from, to: from, dy: 0 })
  }
  const move = (e) => {
    if (!drag) return
    e.preventDefault()
    const dy = e.clientY - (geo.current[drag.from].top + geo.current[drag.from].h / 2)
    setDrag((d) => (d ? { ...d, dy, to: dropIndex(geo.current, d.from, dy) } : d))
  }
  const up = () => { if (!drag) return; if (drag.to !== drag.from) onReorder(moveItem(items, drag.from, drag.to)); setDrag(null) }
  const key = (i) => (e) => {
    const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const to = Math.min(Math.max(i + d, 0), items.length - 1)
    if (to !== i) { onReorder(moveItem(items, i, to)); requestAnimationFrame(() => ref.current?.children[to]?.querySelector('.drag-h')?.focus()) }
  }
  const shift = (i) => {
    if (!drag) return 0
    const h = geo.current[drag.from]?.h || 0
    if (i === drag.from) return drag.dy
    if (drag.to > drag.from && i > drag.from && i <= drag.to) return -h
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return h
    return 0
  }
  return (
    <ul className={`list drag ${className}`} ref={ref}>
      {items.map((it, i) => (
        <li key={keyOf(it)} className={`row drag-row ${itemClass} ${rowClass(it)} ${drag?.from === i ? 'lifted' : ''}`} style={drag ? { transform: `translateY(${shift(i)}px)`, transition: drag.from === i ? 'none' : 'transform .16s var(--out)', zIndex: drag.from === i ? 2 : 1 } : undefined}>
          <button type="button" className="drag-h" aria-label={`Reorder ${labelOf(it)}. Use the arrow keys to move it.`} onPointerDown={down(i)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key(i)}><Icon name="grip" size={18} /></button>
          {renderItem(it, i)}
        </li>
      ))}
    </ul>
  )
}
