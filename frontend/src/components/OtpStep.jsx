import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import OtpInput from './OtpInput'
import { Button } from './ui'
import useCountdown from '../hooks/useCountdown'

/** Shared "enter the code we emailed you" step with resend countdown and a way back. */
export default function OtpStep({ email, code, setCode, onVerify, onResend, onBack, loading, resending }) {
  const [left, start] = useCountdown()
  useEffect(() => { start(60) }, [start])

  const resend = async () => { const ok = await onResend(); if (ok !== false) start(60) }

  return (
    <form className="auth__otp" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) onVerify(code) }}>
      <div>
        <h1 className="auth__title font-display">Check your email</h1>
        <p className="auth__lead">We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.</p>
      </div>
      <OtpInput value={code} onChange={setCode} onComplete={onVerify} disabled={loading} />
      <Button type="submit" size="lg" block loading={loading} disabled={code.length !== 6}>Verify</Button>
      <div className="auth__otp-meta">
        <button type="button" className="auth__link auth__link-btn" onClick={onBack}>
          <ArrowLeft size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Wrong email? Go back
        </button>
        {left > 0
          ? <span aria-live="polite">Resend code in {left}s</span>
          : <button type="button" className="auth__link auth__link-btn" onClick={resend} disabled={resending}>{resending ? 'Sending…' : 'Resend code'}</button>}
      </div>
    </form>
  )
}
