import './Spinner.css'

export default function Spinner({ size = 'md', label = 'Loading' }) {
  return <span className={`ui-spinner ui-spinner--${size}`} role="status" aria-label={label} />
}
