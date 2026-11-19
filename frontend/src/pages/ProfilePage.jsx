import { useState, useEffect, useRef } from 'react'
import { Camera, LogOut, Upload, Download, Users, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import StatCard from '../components/StatCard'
import PasswordInput from '../components/PasswordInput'
import { PageHeader, Card, Button, Input, Select, Textarea, Avatar, RoleBadge, Badge } from '../components/ui'
import '../styles/pages/profile.css'

const DEPTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'BCA', 'MCA', 'MBA', 'BBA', 'Law', 'Pharmacy', 'Other']
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year', 'Faculty']

export default function ProfilePage() {
  const { user, updateUser, setSession, logout } = useAuth()
  const fileRef = useRef(null)
  const [form, setForm] = useState({ name: user?.name || '', department: user?.department || '', year: user?.year || '', bio: user?.bio || '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [activity, setActivity] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => { document.title = 'Profile · Campus Connect' }, [])
  useEffect(() => {
    Promise.all([api.get('/files/mine'), api.get('/groups')]).then(([mine, groups]) => {
      const files = mine.data.files || []
      setActivity({ uploads: files.length, downloads: files.reduce((n, f) => n + (f.download_count || 0), 0), groups: (groups.data.groups || []).filter((g) => g.is_member).length })
    }).catch(() => setActivity({}))
  }, [])

  // Pull the full profile (bio etc.) once
  useEffect(() => {
    api.get('/auth/me').then((r) => { updateUser(r.data.user); setForm({ name: r.data.user.name || '', department: r.data.user.department || '', year: r.data.user.year || '', bio: r.data.user.bio || '' }) }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { const res = await api.put('/auth/profile', form); updateUser(res.data.user); toast.success('Profile updated') }
    catch (err) { toast.error(err.response?.data?.message || 'Update failed') } finally { setSaving(false) }
  }

  const pickAvatar = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Use a JPG or PNG image')
    if (file.size > 2 * 1024 * 1024) return toast.error('Image is too large (max 2 MB)')
    const fd = new FormData(); fd.append('avatar', file)
    setUploading(true)
    try {
      const res = await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      updateUser(res.data.user); toast.success('Photo updated')
    } catch (err) { toast.error(err.response?.data?.message || 'Could not upload photo') } finally { setUploading(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.next.length < 8) return setPwError('Use at least 8 characters')
    setPwSaving(true); setPwError('')
    try {
      const res = await api.put('/auth/password', { currentPassword: pw.current, newPassword: pw.next })
      setSession(res.data.token)     // this session stays signed in; others are signed out
      setPw({ current: '', next: '' }); toast.success('Password changed. Other devices were signed out.')
    } catch (err) { setPwError(err.response?.data?.message || 'Could not change password') } finally { setPwSaving(false) }
  }

  return (
    <div className="profile">
      <PageHeader title="Profile" subtitle="Manage your account" />

      <div className="stat-grid">
        <StatCard icon={Upload} label="My uploads" value={activity?.uploads} tone="info" loading={!activity} />
        <StatCard icon={Download} label="Downloads of my files" value={activity?.downloads} tone="success" loading={!activity} />
        <StatCard icon={Users} label="Groups joined" value={activity?.groups} tone="accent" loading={!activity} />
      </div>

      <div className="profile__grid">
        <Card>
          <div className="profile__head">
            <div className="profile__avatar">
              <Avatar name={user?.name} src={user?.avatar_url} size="xl" />
              <button type="button" className="profile__cam" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change profile photo"><Camera size={16} /></button>
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png" onChange={pickAvatar} />
            </div>
            <div>
              <h2 className="profile__name">{user?.name}</h2>
              <p className="muted">{user?.email}</p>
              <div className="profile__badges"><RoleBadge role={user?.role} />{user?.requested_role && <Badge tone="warning">Faculty request pending</Badge>}</div>
            </div>
          </div>
          {user?.requested_role && (
            <div className="auth__banner auth__banner--info" role="note"><Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />An admin will review your faculty request. You'll keep student access until then.</div>
          )}
          <form className="profile__form" onSubmit={save}>
            <Input label="Full name" required maxLength={100} value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label="Email" value={user?.email || ''} disabled hint="Email can't be changed. Contact an admin if needed." />
            <div className="upload-form__row">
              <Select label="Department" value={form.department} onChange={(e) => set('department', e.target.value)}><option value="">None</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</Select>
              <Select label="Year" value={form.year} onChange={(e) => set('year', e.target.value)}><option value="">None</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</Select>
            </div>
            <Textarea label="Bio" maxLength={500} placeholder="A line or two about you" value={form.bio} onChange={(e) => set('bio', e.target.value)} hint={`${form.bio.length}/500`} />
            <div><Button type="submit" loading={saving}>Save changes</Button></div>
          </form>
        </Card>

        <div className="profile__side">
          <Card>
            <h2 className="ui-card__title">Change password</h2>
            <form className="profile__form" onSubmit={changePassword}>
              <PasswordInput label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => { setPw((p) => ({ ...p, current: e.target.value })); setPwError('') }} required />
              <PasswordInput label="New password" autoComplete="new-password" placeholder="At least 8 characters" value={pw.next} error={pwError} onChange={(e) => { setPw((p) => ({ ...p, next: e.target.value })); setPwError('') }} required />
              <p className="ui-field__msg">You'll stay signed in here. Other devices will be signed out.</p>
              <div><Button type="submit" variant="secondary" loading={pwSaving}>Update password</Button></div>
            </form>
          </Card>
          <Card>
            <h2 className="ui-card__title">Session</h2>
            <Button variant="secondary" leftIcon={<LogOut size={16} />} onClick={logout}>Sign out</Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
