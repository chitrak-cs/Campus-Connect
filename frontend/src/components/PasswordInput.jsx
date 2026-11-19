import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './ui'

/** Password field with a show/hide toggle. */
export default function PasswordInput({ label = 'Password', ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <Input label={label} type={show ? 'text' : 'password'} {...rest}
      rightSlot={
        <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      } />
  )
}
