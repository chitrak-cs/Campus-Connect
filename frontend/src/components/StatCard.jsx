export default function StatCard({ icon: Icon, label, value, tone = 'info', loading }) {
  return (
    <div className="stat">
      <span className={`stat__icon stat__icon--${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <div>
        <div className="stat__label">{label}</div>
        <div className="stat__value">{loading ? <span className="ui-skeleton" style={{ width: 40, height: 26, display: 'inline-block' }} /> : (value ?? '–')}</div>
      </div>
    </div>
  )
}
