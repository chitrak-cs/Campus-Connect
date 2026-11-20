import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import AuthShell from '../components/AuthShell'
import OtpStep from '../components/OtpStep'
import PasswordInput from '../components/PasswordInput'
import { Input, Select, Button } from '../components/ui'

const DEPTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'BCA', 'MCA', 'MBA', 'BBA', 'Law', 'Pharmacy', 'Other']
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year', 'Faculty']

// Simple, honest strength hint: length first, then variety
const strength = (pw) => {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++
  return pw.length < 8 ? 0 : Math.max(1, score)
}
const STRENGTH = [
  { label: 'At least 8 characters', color: 'var(--border-strong)', w: '8%' },
  { label: 'Weak', color: 'var(--danger)', w: '25%' },
  { label: 'Okay', color: 'var(--warning)', w: '50%' },
  { label: 'Good', color: 'var(--info)', w: '75%' },
  { label: 'Strong', color: 'var(--success)', w: '100%' },
]

export default function RegisterPage() {
  const { register, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', year: '', role: 'student' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [registerId, setRegisterId] = useState(null)
  const [facultyPending, setFacultyPending] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => { document.title = 'Create account · Campus Connect' }, [])
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })) }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Please enter your name'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address'
    if (form.password.length < 8) e.password = 'Use at least 8 characters'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await register({ ...form, name: form.name.trim(), email: form.email.trim() })
      if (res?.otpRequired) {
        setRegisterId(res.registerId); setFacultyPending(!!res.facultyPending)
        toast.success('Verification code sent to your email')
        return
      }
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed'
      if (err.response?.status === 409) setErrors({ email: msg })
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const handleVerify = async (value) => {
    if (loading || !registerId) return
    setLoading(true)
    try {
      await verifyOtp(registerId, value)
      toast.success(facultyPending ? 'Account created. Your faculty role is awaiting admin approval.' : 'Account verified. Welcome!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
      setCode('')
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const res = await api.post('/auth/resend-otp', { id: registerId })
      setRegisterId(res.data.id); setCode(''); toast.success('New code sent')
      return true
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code')
      return false
    } finally { setResending(false) }
  }

  const s = strength(form.password)

  return (
    <AuthShell headline={<>Join the<br />campus community.</>}>
      {registerId ? (
        <OtpStep email={form.email} code={code} setCode={setCode} onVerify={handleVerify} onResend={handleResend}
          onBack={() => { setRegisterId(null); setCode('') }} loading={loading} resending={resending} />
      ) : (
        <form className="auth__form" onSubmit={handleRegister} noValidate>
          <div>
            <h1 className="auth__title font-display">Create your account</h1>
            <p className="auth__lead">It takes a minute. We'll email you a verification code.</p>
          </div>
          <Input label="Full name" autoComplete="name" placeholder="Your name" value={form.name} error={errors.name}
            onChange={(e) => set('name', e.target.value)} />
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@university.ac.in" value={form.email} error={errors.email}
            onChange={(e) => set('email', e.target.value)} />
          <div>
            <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" value={form.password} error={errors.password}
              onChange={(e) => set('password', e.target.value)} />
            {form.password && (
              <div className="auth__strength-wrap">
                <div className="auth__strength" aria-hidden="true"><span style={{ width: STRENGTH[s].w, background: STRENGTH[s].color }} /></div>
                <p className="ui-field__msg auth__strength-label" aria-live="polite">{STRENGTH[s].label}</p>
              </div>
            )}
          </div>
          <div className="auth__row">
            <Select label="Department" value={form.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">Select</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}
            </Select>
            <Select label="Year" value={form.year} onChange={(e) => set('year', e.target.value)}>
              <option value="">Select</option>{YEARS.map((y) => <option key={y}>{y}</option>)}
            </Select>
          </div>
          <fieldset className="fieldset">
            <legend className="ui-label legend">I am a</legend>
            <div className="seg">
              <button type="button" className="seg__btn" aria-pressed={form.role === 'student'} onClick={() => set('role', 'student')}>Student</button>
              <button type="button" className="seg__btn" aria-pressed={form.role === 'faculty'} onClick={() => set('role', 'faculty')}>Faculty (needs admin approval)</button>
            </div>
          </fieldset>
          {form.role === 'faculty' && (
            <div className="auth__banner auth__banner--info" role="note"><Info size={16} aria-hidden="true" className="banner-icon" />
              You'll start as a student. An admin reviews faculty requests before the role is granted.</div>
          )}
          <Button type="submit" size="lg" block loading={loading}>Create account</Button>
          <p className="auth__alt">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      )}
    </AuthShell>
  )
}
