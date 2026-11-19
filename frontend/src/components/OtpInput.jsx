import { useRef } from 'react'
import '../styles/pages/otp.css'

/** Six single-digit boxes. Supports typing, backspace, arrows and pasting a full code. */
export default function OtpInput({ value, onChange, onComplete, disabled, length = 6, autoFocus = true }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  const set = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
  }

  const onInput = (i, e) => {
    const d = e.target.value.replace(/\D/g, '')
    if (!d) return
    if (d.length > 1) { set(value.slice(0, i) + d); refs.current[Math.min(i + d.length, length - 1)]?.focus(); return }
    const next = value.slice(0, i) + d + value.slice(i + 1)
    set(next)
    refs.current[Math.min(i + 1, length - 1)]?.focus()
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) set(value.slice(0, i) + value.slice(i + 1))
      else if (i > 0) { set(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus() }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onPaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    set(text)
    refs.current[Math.min(text.replace(/\D/g, '').length, length - 1)]?.focus()
  }

  return (
    <div className="otp" role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }} className="otp__box" value={d} disabled={disabled}
          inputMode="numeric" pattern="[0-9]*" maxLength={length} autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0} aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKeyDown(i, e)} onPaste={onPaste} onFocus={(e) => e.target.select()} />
      ))}
    </div>
  )
}
