import './PageHeader.css'

export default function PageHeader({ title, subtitle, actions, serif = true }) {
  return (
    <header className="ui-page-header">
      <div>
        <h1 className={`ui-page-header__title ${serif ? 'font-display' : ''}`}>{title}</h1>
        {subtitle && <p className="ui-page-header__sub">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  )
}
