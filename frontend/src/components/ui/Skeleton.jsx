import './Skeleton.css'

export default function Skeleton({ width = '100%', height = 14, radius, className = '', style }) {
  return <span className={`ui-skeleton ${className}`} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />
}

export const SkeletonList = ({ rows = 4, height = 64 }) => (
  <div className="ui-skeleton-list" role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={height} radius="var(--r-lg)" />)}
  </div>
)
