import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import AuthShell from '../components/AuthShell'
import OtpInput from '../components/OtpInput'
import PasswordInput from '../components/PasswordInput'
import { Input, Button } from '../components/ui'
import useCountdown from '../hooks/useCountdown'

export default function ForgotPasswordPage() {
  const { setSession } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [resetId, setResetId] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [left, start] = useCountdown()

  useEffect(() => { document.title = 'Reset password · Campus Connect' }, [])

  const request = async (e) => {
    e?.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() })
      setResetId(res.data.resetId); setCode(''); start(60)
      toast.success('If that email is registered, a code is on its way')
    } catch (err) { toast.error(err.response?.data?.message || 'Something went wrong') } finally { setLoading(false) }
  }

  const reset = async (e) => {
    e.preventDefault()
    if (code.length !== 6) return setError('Enter the 6-digit code')
    if (password.length < 8) return setError('Use at least 8 characters for your new password')
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/reset-password', { resetId, code, newPassword: password })
      setSession(res.data.token, res.data.user)
      toast.success('Password updated. You are signed in.')
      navigate('/')
    } catch (err) { setError(err.response?.data?.message || 'Could not reset password') } finally { setLoading(false) }
  }

  return (
    <AuthShell headline={<>Locked out?<br />We'll get you back in.</>}>
      {!resetId ? (
        <form className="auth__form" onSubmit={request}>
          <div>
            <h1 className="auth__title font-display">Forgot password</h1>
            <p className="auth__lead">Enter your email and we'll send a 6-digit code to reset it.</p>
          </div>
          <Input label="Email address" type="email" autoComplete="email" required placeholder="you@university.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" block loading={loading}>Send code</Button>
          <p className="auth__alt"><Link to="/login">Back to sign in</Link></p>
        </form>
      ) : (
        <form className="auth__form" onSubmit={reset}>
          <div>
            <h1 className="auth__title font-display">Set a new password</h1>
            <p className="auth__lead">If <strong>{email}</strong> is registered, we sent it a code. It expires in 15 minutes.</p>
          </div>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError('') }} disabled={loading} />
          <PasswordInput label="New password" autoComplete="new-password" placeholder="At least 8 characters" value={password} error={error}
            onChange={(e) => { setPassword(e.target.value); setError('') }} />
          <Button type="submit" size="lg" block loading={loading}>Update password</Button>
          <div className="auth__otp-meta">
            <button type="button" className="auth__link auth__link-btn" onClick={() => setResetId(null)}><ArrowLeft size={13} aria-hidden="true" className="icon-inline" /> Use a different email</button>
            {left > 0 ? <span aria-live="polite">Resend in {left}s</span>
              : <button type="button" className="auth__link auth__link-btn" onClick={request} disabled={loading}>Resend code</button>}
          </div>
        </form>
      )}
    </AuthShell>
  )
}
