import './Button.css'

/** variants: primary | secondary | ghost | danger — sizes: sm | md | lg */
export default function Button({
  variant = 'primary', size = 'md', loading = false, leftIcon = null, block = false,
  className = '', children, disabled, type = 'button', ...rest
}) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${block ? 'ui-btn--block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="ui-spinner ui-spinner--sm" aria-hidden="true" /> : leftIcon}
      {children && <span>{children}</span>}
    </button>
  )
}
