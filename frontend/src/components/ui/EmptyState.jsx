import './EmptyState.css'

export default function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="ui-empty">
      {Icon && <span className="ui-empty__icon"><Icon size={28} aria-hidden="true" /></span>}
      <h3 className="ui-empty__title">{title}</h3>
      {text && <p className="ui-empty__text">{text}</p>}
      {action}
    </div>
  )
}
