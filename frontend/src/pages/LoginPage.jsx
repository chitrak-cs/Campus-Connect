import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import AuthShell from '../components/AuthShell'
import OtpStep from '../components/OtpStep'
import PasswordInput from '../components/PasswordInput'
import { Input, Button } from '../components/ui'

export default function LoginPage() {
  const { login, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [loginId, setLoginId] = useState(null)
  const [code, setCode] = useState('')

  useEffect(() => { document.title = 'Sign in · Campus Connect' }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(form.email.trim(), form.password)
      if (res?.otpRequired) { setLoginId(res.loginId); setCode(''); toast('Verification code sent to your email'); return }
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const handleVerify = async (value) => {
    if (loading || !loginId) return
    setLoading(true)
    try {
      await verifyOtp(loginId, value)
      toast.success('Verified. Welcome!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
      setCode('')
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const res = await api.post('/auth/resend-otp', { id: loginId })
      setLoginId(res.data.id); setCode(''); toast.success('New code sent')
      return true
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code')
      return false
    } finally { setResending(false) }
  }

  return (
    <AuthShell headline={<>Your campus,<br />in one place.</>}>
      {loginId ? (
        <OtpStep email={form.email} code={code} setCode={setCode} onVerify={handleVerify} onResend={handleResend}
          onBack={() => { setLoginId(null); setCode('') }} loading={loading} resending={resending} />
      ) : (
        <form className="auth__form" onSubmit={handleLogin} noValidate={false}>
          <div>
            <h1 className="auth__title font-display">Sign in</h1>
            <p className="auth__lead">Welcome back. Enter your details to continue.</p>
          </div>
          {params.get('expired') && (
            <div className="auth__banner auth__banner--warn" role="status"><Clock size={16} aria-hidden="true" /> Your session expired. Please sign in again.</div>
          )}
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@university.ac.in" required
            value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <div>
            <PasswordInput autoComplete="current-password" placeholder="Your password" required
              value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            <p className="auth__forgot"><Link to="/forgot-password" className="auth__link">Forgot password?</Link></p>
          </div>
          <Button type="submit" size="lg" block loading={loading}>Sign in</Button>
          <p className="auth__alt">No account yet? <Link to="/register">Create one</Link></p>
        </form>
      )}
    </AuthShell>
  )
}
