import './Avatar.css'

const PALETTE = ['#1A5FA8', '#1A7A4A', '#8B4A9C', '#B3261E', '#B5651D', '#0B7285', '#5F3DC4', '#8A6D1F']
const hash = (s = '') => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const initials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

/** Image avatar, or initials on a color hashed from the name. size: xs | sm | md | lg | xl */
export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  return (
    <span className={`ui-avatar ui-avatar--${size} ${className}`} style={src ? undefined : { background: PALETTE[hash(name) % PALETTE.length] }} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : initials(name)}
    </span>
  )
}
