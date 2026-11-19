import './Badge.css'

/** tone: neutral | primary | accent | success | danger | warning | info */
export default function Badge({ tone = 'neutral', outline = false, className = '', children }) {
  return <span className={`ui-badge ui-badge--${tone} ${outline ? 'ui-badge--outline' : ''} ${className}`}>{children}</span>
}

const ROLE_TONE = { admin: 'danger', faculty: 'accent', student: 'neutral' }
export const RoleBadge = ({ role }) => <Badge tone={ROLE_TONE[role] || 'neutral'}>{role}</Badge>

const PRIORITY_TONE = { high: 'danger', medium: 'info', low: 'neutral' }
export const PriorityBadge = ({ priority }) => <Badge tone={PRIORITY_TONE[priority] || 'neutral'} outline={priority === 'high'}>{priority}</Badge>

export const StatusBadge = ({ approved }) =>
  approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Pending</Badge>
