import { useRef } from 'react'
import './Tabs.css'

/** tabs: [{ id, label, count? }]. Arrow keys move between tabs. */
export default function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const refs = useRef({})
  const onKeyDown = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => { refs.current[t.id] = el }} type="button" role="tab" id={`tab-${t.id}`}
          aria-selected={value === t.id} aria-controls={`panel-${t.id}`} tabIndex={value === t.id ? 0 : -1}
          className={`ui-tab ${value === t.id ? 'is-active' : ''}`} onClick={() => onChange(t.id)} onKeyDown={(e) => onKeyDown(e, i)}>
          {t.label}{t.count > 0 && <span className="ui-tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
