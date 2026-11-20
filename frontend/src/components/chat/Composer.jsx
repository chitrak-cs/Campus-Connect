import { useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

const MAX = 2000

/** Auto-growing textarea. Enter sends, Shift+Enter adds a newline. */
export default function Composer({ value, onChange, onSend, onTyping, disabled, placeholder }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend() }
    else if (e.key.length === 1) onTyping?.()
  }
  const left = MAX - value.length
  return (
    <div className="composer">
      <div className="composer__field">
        <textarea ref={ref} rows={1} maxLength={MAX} value={value} disabled={disabled} placeholder={disabled ? 'Reconnecting…' : placeholder}
          aria-label="Message" onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
        {left <= 200 && <span className={`composer__count ${left < 50 ? 'is-low' : ''}`} aria-live="polite">{left}</span>}
      </div>
      <button type="button" className="composer__send" onClick={onSend} disabled={disabled || !value.trim()} aria-label="Send message"><Send size={18} /></button>
    </div>
  )
}
