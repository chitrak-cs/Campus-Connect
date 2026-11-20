import { useId, forwardRef } from 'react'
import './Field.css'

// Shared wrapper: label + control + hint/error wired up with aria-describedby
function Field({ label, hint, error, id, children, className = '' }) {
  return (
    <div className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`}>
      {label && <label className="ui-label" htmlFor={id}>{label}</label>}
      {children}
      {error
        ? <p className="ui-field__msg ui-field__msg--error" id={`${id}-msg`} role="alert">{error}</p>
        : hint && <p className="ui-field__msg" id={`${id}-msg`}>{hint}</p>}
    </div>
  )
}

const describe = (id, error, hint) => (error || hint ? `${id}-msg` : undefined)

export const Input = forwardRef(function Input({ label, hint, error, className = '', rightSlot, ...rest }, ref) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} id={id} className={className}>
      <div className="ui-control-wrap">
        <input ref={ref} id={id} className="ui-control" aria-invalid={!!error || undefined}
          aria-describedby={describe(id, error, hint)} {...rest} />
        {rightSlot}
      </div>
    </Field>
  )
})

export const Textarea = forwardRef(function Textarea({ label, hint, error, className = '', ...rest }, ref) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} id={id} className={className}>
      <textarea ref={ref} id={id} className="ui-control ui-control--textarea" aria-invalid={!!error || undefined}
        aria-describedby={describe(id, error, hint)} {...rest} />
    </Field>
  )
})

export const Select = forwardRef(function Select({ label, hint, error, className = '', children, ...rest }, ref) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} id={id} className={className}>
      <select ref={ref} id={id} className="ui-control ui-control--select" aria-invalid={!!error || undefined}
        aria-describedby={describe(id, error, hint)} {...rest}>{children}</select>
    </Field>
  )
})
