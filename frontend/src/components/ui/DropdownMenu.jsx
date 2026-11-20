import { useState, useRef, useEffect, useId } from 'react'
import './DropdownMenu.css'

/** trigger: a render function ({ open, props }) => element. items: [{ label, icon, onClick, danger, hidden }] */
export default function DropdownMenu({ trigger, items = [], panel, align = 'right', label = 'Menu' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const menuId = useId()
  const visible = items.filter((i) => !i.hidden)
  const hasPanel = !!panel

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); rootRef.current?.querySelector('[aria-haspopup]')?.focus() } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    if (!hasPanel) rootRef.current?.querySelector('[role="menuitem"]')?.focus()
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open, hasPanel])

  const onMenuKey = (e) => {
    const els = [...rootRef.current.querySelectorAll('[role="menuitem"]')]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
  }

  return (
    <div className="ui-menu" ref={rootRef}>
      {trigger({ open, props: { 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': open ? menuId : undefined, 'aria-label': label, onClick: () => setOpen((o) => !o) } })}
      {open && panel && (
        <div id={menuId} className={`ui-menu__panel ui-menu__panel--${align} ui-menu__panel--wide`}>
          {panel({ close: () => setOpen(false) })}
        </div>
      )}
      {open && !panel && (
        <div id={menuId} role="menu" className={`ui-menu__panel ui-menu__panel--${align}`} onKeyDown={onMenuKey}>
          {visible.map((it, i) => (
            <button key={i} type="button" role="menuitem" className={`ui-menu__item ${it.danger ? 'is-danger' : ''}`}
              onClick={() => { setOpen(false); it.onClick?.() }}>
              {it.icon && <it.icon size={16} aria-hidden="true" />}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
