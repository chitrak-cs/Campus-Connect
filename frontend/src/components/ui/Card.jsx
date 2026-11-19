import './Card.css'

export default function Card({ as: Tag = 'div', padded = true, interactive = false, className = '', children, ...rest }) {
  return (
    <Tag className={`ui-card ${padded ? 'ui-card--padded' : ''} ${interactive ? 'ui-card--interactive' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
