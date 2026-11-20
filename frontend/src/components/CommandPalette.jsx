import { useState, useEffect, useRef, useMemo, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Users, LayoutDashboard, MessageSquare, User, Lock, CornerDownLeft } from 'lucide-react'
import { createPortal } from 'react-dom'
import api from '../utils/api'
import '../styles/pages/palette.css'

const PAGES = [
  { id: 'p-dash', label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { id: 'p-files', label: 'Files', icon: FileText, to: '/files' },
  { id: 'p-chat', label: 'Chat', icon: MessageSquare, to: '/chat' },
  { id: 'p-groups', label: 'Groups', icon: Users, to: '/groups' },
  { id: 'p-profile', label: 'Profile', icon: User, to: '/profile' },
]

/** Quick search (Ctrl/Cmd+K). Arrow keys move, Enter opens, Esc closes. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ files: [], groups: [] })
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listId = useId()

  useEffect(() => { if (open) { setQ(''); setResults({ files: [], groups: [] }); setActive(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  // Debounced search
  useEffect(() => {
    const term = q.trim()
    if (!open || !term) { setResults({ files: [], groups: [] }); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      api.get('/search', { params: { q: term } })
        .then((r) => { if (!cancelled) { setResults(r.data); setActive(0) } })
        .catch(() => { if (!cancelled) setResults({ files: [], groups: [] }) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, open])

  // One flat list drives keyboard navigation
  const items = useMemo(() => {
    if (!q.trim()) return PAGES.map((p) => ({ ...p, section: 'Go to', run: () => navigate(p.to) }))
    return [
      ...results.files.map((f) => ({ id: `f-${f.id}`, section: 'Files', label: f.title, hint: [f.subject, f.department, f.year].filter(Boolean).join(' · '), icon: FileText, run: () => navigate('/files', { state: { search: f.title } }) })),
      ...results.groups.map((g) => ({ id: `g-${g.id}`, section: 'Groups', label: g.name, hint: g.department || (g.is_private ? 'Private group' : 'Public group'), icon: g.is_private ? Lock : Users, run: () => navigate(g.is_member ? '/chat' : '/groups', { state: g.is_member ? { groupId: g.id } : { search: g.name } }) })),
    ]
  }, [q, results, navigate])

  const choose = (item) => { onClose(); item?.run() }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (items.length ? (a + 1) % items.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]) }
  }

  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active, listId])

  if (!open) return null
  let lastSection = null
  return createPortal(
    <div className="palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick search" onKeyDown={onKeyDown}>
        <div className="palette__input">
          <Search size={18} aria-hidden="true" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files and groups…" role="combobox"
            aria-expanded="true" aria-controls={listId} aria-activedescendant={items[active] ? `${listId}-${active}` : undefined} aria-label="Search files and groups" />
          <kbd>Esc</kbd>
        </div>
        <ul id={listId} role="listbox" className="palette__list">
          {items.map((it, i) => {
            const header = it.section !== lastSection ? (lastSection = it.section) : null
            return (
              <li key={it.id} role="presentation">
                {header && <div className="palette__section">{header}</div>}
                <button type="button" id={`${listId}-${i}`} role="option" aria-selected={i === active} className={`palette__item ${i === active ? 'is-active' : ''}`}
                  onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
                  <it.icon size={16} aria-hidden="true" />
                  <span className="palette__text"><strong>{it.label}</strong>{it.hint && <small>{it.hint}</small>}</span>
                  {i === active && <CornerDownLeft size={14} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
          {q.trim() && !loading && items.length === 0 && <li className="palette__empty" role="presentation">No results for “{q.trim()}”</li>}
          {q.trim() && loading && items.length === 0 && <li className="palette__empty" role="presentation">Searching…</li>}
        </ul>
      </div>
    </div>,
    document.body
  )
}
