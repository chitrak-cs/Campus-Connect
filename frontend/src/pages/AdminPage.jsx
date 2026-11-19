import { useState, useEffect, useCallback } from 'react'
import {
  Users, FileText, Download, MessageSquare, Layers, Clock, UserCheck, Check, X, Eye, MoreVertical,
  Plus, Search, Trash2, ShieldCheck, GraduationCap, UserMinus, UserPlus, Megaphone, BadgeCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { fileSize } from '../utils/format'
import StatCard from '../components/StatCard'
import FileTypeIcon from '../components/FileTypeIcon'
import PreviewModal from '../components/files/PreviewModal'
import {
  PageHeader, Tabs, Card, Button, Badge, RoleBadge, PriorityBadge, Avatar, EmptyState, SkeletonList,
  ConfirmDialog, DropdownMenu, Modal, Input, Select, Textarea,
} from '../components/ui'
import '../styles/pages/admin.css'

const ROLES = ['student', 'faculty', 'admin']
const PAGE_SIZE = 20

/* ───────── Create user ───────── */
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', department: '', year: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError('') }
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try { await api.post('/admin/users', form); toast.success('User created'); onCreated(); onClose() }
    catch (err) { setError(err.response?.data?.message || 'Could not create user') } finally { setSaving(false) }
  }
  return (
    <Modal onClose={onClose} title="Create user"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="create-user" loading={saving}>Create user</Button></>}>
      <form id="create-user" className="upload-form" onSubmit={submit}>
        <Input label="Full name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Temporary password" type="password" required autoComplete="new-password" hint="At least 8 characters. Ask them to change it after signing in." value={form.password} error={error} onChange={(e) => set('password', e.target.value)} />
        <Select label="Role" value={form.role} onChange={(e) => set('role', e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
      </form>
    </Modal>
  )
}

/* ───────── Overview ───────── */
function Overview({ stats, loading, go }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard icon={Users} label="Members" value={stats?.users} tone="info" loading={loading} />
        <StatCard icon={FileText} label="Approved files" value={stats?.files} tone="success" loading={loading} />
        <StatCard icon={Clock} label="Pending files" value={stats?.pending} tone="danger" loading={loading} />
        <StatCard icon={Layers} label="Groups" value={stats?.groups} tone="accent" loading={loading} />
        <StatCard icon={MessageSquare} label="Messages" value={stats?.messages} tone="info" loading={loading} />
        <StatCard icon={Download} label="Downloads" value={stats?.downloads} tone="success" loading={loading} />
      </div>
      {(stats?.pending > 0 || stats?.pendingRoleRequests > 0) && (
        <div className="stack">
          {stats.pending > 0 && <button type="button" className="alert alert--danger" onClick={() => go('files')}><Clock size={16} /> {stats.pending} file{stats.pending > 1 ? 's' : ''} waiting for review</button>}
          {stats.pendingRoleRequests > 0 && <button type="button" className="alert alert--warning" onClick={() => go('roles')}><UserCheck size={16} /> {stats.pendingRoleRequests} faculty request{stats.pendingRoleRequests > 1 ? 's' : ''} waiting for review</button>}
        </div>
      )}
    </>
  )
}

export default function AdminPage() {
  const { user: me } = useAuth()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  const [announcements, setAnnouncements] = useState([])
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'low' })
  const [posting, setPosting] = useState(false)

  const [confirm, setConfirm] = useState(null) // { title, message, confirmLabel, danger, run }

  const loadStats = useCallback(async () => {
    try { setStats((await api.get('/admin/stats')).data) } catch { toast.error('Could not load stats') } finally { setStatsLoading(false) }
  }, [])
  const loadPending = useCallback(async () => {
    setPendingLoading(true)
    try { setPending((await api.get('/files/pending')).data.files || []) } catch { toast.error('Could not load pending files') } finally { setPendingLoading(false) }
  }, [])
  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try { setUsers((await api.get('/admin/users', { params: { search: debounced || undefined, role: roleFilter || undefined, page, limit: PAGE_SIZE } })).data.users || []) }
    catch { toast.error('Could not load users') } finally { setUsersLoading(false) }
  }, [debounced, roleFilter, page])
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true)
    try { setRequests((await api.get('/admin/role-requests')).data.requests || []) } catch { toast.error('Could not load requests') } finally { setRequestsLoading(false) }
  }, [])
  const loadAnnouncements = useCallback(async () => {
    try { setAnnouncements((await api.get('/admin/announcements')).data.announcements || []) } catch { toast.error('Could not load announcements') }
  }, [])

  useEffect(() => { document.title = 'Admin · Campus Connect'; loadStats() }, [loadStats])
  useEffect(() => { const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { if (tab === 'files') loadPending() }, [tab, loadPending])
  useEffect(() => { if (tab === 'users') loadUsers() }, [tab, loadUsers])
  useEffect(() => { if (tab === 'roles') loadRequests() }, [tab, loadRequests])
  useEffect(() => { if (tab === 'announce') loadAnnouncements() }, [tab, loadAnnouncements])

  // Run a mutation, toast the result, then refresh what changed
  const act = async (fn, okMsg, refresh = []) => {
    try { await fn(); toast.success(okMsg); refresh.forEach((r) => r()) }
    catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
  }

  const askConfirm = (cfg) => setConfirm(cfg)
  const runConfirm = async () => { const c = confirm; setConfirm(null); await c.run() }

  const approve = (f) => act(() => api.put(`/files/${f.id}/approve`), 'File approved', [loadPending, loadStats])
  const reject = (f) => askConfirm({ title: 'Reject this file?', danger: true, confirmLabel: 'Reject and delete',
    message: `"${f.title}" will be deleted and the uploader won't be notified.`, run: () => act(() => api.delete(`/files/${f.id}`), 'File rejected', [loadPending, loadStats]) })
  const download = async (f) => { try { window.open((await api.post(`/files/${f.id}/download`)).data.url, '_blank', 'noopener') } catch { toast.error('Download failed') } }

  const setRole = (u, role) => act(() => api.put(`/admin/users/${u.id}`, { role }), `${u.name} is now ${role}`, [loadUsers, loadStats])
  const setActive = (u, is_active) => act(() => api.put(`/admin/users/${u.id}`, { is_active }), is_active ? 'User reactivated' : 'User deactivated', [loadUsers])
  const removeUser = (u) => askConfirm({ title: 'Delete this user?', danger: true, confirmLabel: 'Delete user',
    message: `${u.name} and everything they uploaded will be permanently deleted. This can't be undone.`, run: () => act(() => api.delete(`/admin/users/${u.id}`), 'User deleted', [loadUsers, loadStats]) })
  const deactivate = (u) => askConfirm({ title: 'Deactivate this user?', danger: true, confirmLabel: 'Deactivate',
    message: `${u.name} will be signed out and unable to sign in until reactivated.`, run: () => setActive(u, false) })

  const approveReq = (u) => act(() => api.post(`/admin/role-requests/${u.id}/approve`), `${u.name} is now faculty`, [loadRequests, loadStats])
  const rejectReq = (u) => act(() => api.post(`/admin/role-requests/${u.id}/reject`), 'Request rejected', [loadRequests, loadStats])

  const postAnnouncement = async (e) => {
    e.preventDefault()
    setPosting(true)
    await act(() => api.post('/admin/announcements', annForm), 'Announcement posted', [loadAnnouncements])
    setAnnForm({ title: '', content: '', priority: 'low' }); setPosting(false)
  }
  const removeAnnouncement = (a) => askConfirm({ title: 'Delete announcement?', danger: true, confirmLabel: 'Delete',
    message: `"${a.title}" will no longer be shown to anyone.`, run: () => act(() => api.delete(`/admin/announcements/${a.id}`), 'Announcement deleted', [loadAnnouncements]) })

  const userMenu = (u) => {
    const self = u.id === me?.id
    return [
      { label: 'Make student', icon: GraduationCap, hidden: u.role === 'student' || self, onClick: () => setRole(u, 'student') },
      { label: 'Make faculty', icon: BadgeCheck, hidden: u.role === 'faculty' || self, onClick: () => setRole(u, 'faculty') },
      { label: 'Make admin', icon: ShieldCheck, hidden: u.role === 'admin' || self, onClick: () => setRole(u, 'admin') },
      { label: 'Reactivate', icon: UserPlus, hidden: u.is_active, onClick: () => setActive(u, true) },
      { label: 'Deactivate', icon: UserMinus, hidden: !u.is_active || self, danger: true, onClick: () => deactivate(u) },
      { label: 'Delete user', icon: Trash2, hidden: self, danger: true, onClick: () => removeUser(u) },
    ]
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'files', label: 'Pending files', count: stats?.pending },
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Role requests', count: stats?.pendingRoleRequests },
    { id: 'announce', label: 'Announcements' },
  ]

  return (
    <div>
      <PageHeader title="Admin" subtitle="Review uploads, manage people, and post announcements" />
      <Tabs label="Admin sections" tabs={tabs} value={tab} onChange={setTab} />

      <div className="admin__panel" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && <Overview stats={stats} loading={statsLoading} go={setTab} />}

        {tab === 'files' && (pendingLoading ? <SkeletonList rows={3} /> : pending.length === 0 ? (
          <Card><EmptyState icon={Check} title="All caught up" text="There are no files waiting for review." /></Card>
        ) : (
          <div className="stack">
            {pending.map((f) => (
              <div key={f.id} className="row-card row-card--wrap">
                <FileTypeIcon file={f} />
                <div className="row-card__main">
                  <div className="row-card__title">{f.title}</div>
                  <div className="row-card__meta">{[f.subject, f.department, f.year].filter(Boolean).join(' · ')}<span className="dot-sep" />{f.uploader_name} ({f.uploader_email})<span className="dot-sep" />{fileSize(f)}<span className="dot-sep" />{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</div>
                </div>
                <div className="admin__actions">
                  <Button size="sm" variant="secondary" leftIcon={<Eye size={14} />} onClick={() => setPreview(f)}>Preview</Button>
                  <Button size="sm" leftIcon={<Check size={14} />} onClick={() => approve(f)}>Approve</Button>
                  <Button size="sm" variant="ghost" className="gcard__danger" leftIcon={<X size={14} />} onClick={() => reject(f)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {tab === 'users' && (
          <>
            <div className="admin__toolbar">
              <label className="ftools__search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search users</span>
                <input type="search" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
              <Select aria-label="Filter by role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}>
                <option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
              <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>Create user</Button>
            </div>
            {usersLoading ? <SkeletonList rows={5} height={52} /> : users.length === 0 ? (
              <Card><EmptyState icon={Users} title="No users found" text="Try a different search or role filter." /></Card>
            ) : (
              <>
                <div className="dtable-wrap">
                  <table className="dtable">
                    <thead><tr><th>User</th><th>Role</th><th>Status</th><th className="dtable__hide">Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td><div className="dtable__user"><Avatar name={u.name} size="sm" /><div><div className="dtable__name">{u.name}{u.id === me?.id && <span className="muted"> (you)</span>}</div><div className="dtable__email">{u.email}</div></div></div></td>
                          <td><RoleBadge role={u.role} />{u.requested_role && <Badge tone="warning" className="dtable__req">wants {u.requested_role}</Badge>}</td>
                          <td>{u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Deactivated</Badge>}</td>
                          <td className="dtable__hide muted">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="dtable__end">
                            {u.id !== me?.id || !u.is_active ? (
                              <DropdownMenu label={`Actions for ${u.name}`} trigger={({ props }) => <button type="button" className="fbtn fbtn--icon" {...props}><MoreVertical size={16} /></button>} items={userMenu(u)} />
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="admin__pager">
                  <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="muted">Page {page}</span>
                  <Button size="sm" variant="secondary" disabled={users.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'roles' && (requestsLoading ? <SkeletonList rows={2} /> : requests.length === 0 ? (
          <Card><EmptyState icon={UserCheck} title="No pending requests" text="Faculty role requests will appear here for you to approve." /></Card>
        ) : (
          <div className="stack">
            {requests.map((u) => (
              <div key={u.id} className="row-card row-card--wrap">
                <Avatar name={u.name} size="md" />
                <div className="row-card__main">
                  <div className="row-card__title">{u.name}</div>
                  <div className="row-card__meta">{u.email}{u.department && <><span className="dot-sep" />{u.department}</>}<span className="dot-sep" />joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</div>
                </div>
                <div className="admin__actions">
                  <Button size="sm" leftIcon={<Check size={14} />} onClick={() => approveReq(u)}>Approve as faculty</Button>
                  <Button size="sm" variant="ghost" className="gcard__danger" onClick={() => rejectReq(u)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {tab === 'announce' && (
          <div className="admin__split">
            <Card>
              <h2 className="ui-card__title">New announcement</h2>
              <form className="upload-form" onSubmit={postAnnouncement}>
                <Input label="Title" required maxLength={255} value={annForm.title} onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))} />
                <Textarea label="Message" required maxLength={5000} value={annForm.content} onChange={(e) => setAnnForm((f) => ({ ...f, content: e.target.value }))} />
                <Select label="Priority" value={annForm.priority} onChange={(e) => setAnnForm((f) => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </Select>
                <div><Button type="submit" loading={posting} leftIcon={<Megaphone size={16} />}>Post announcement</Button></div>
              </form>
            </Card>
            <div className="stack">
              {announcements.length === 0 ? <Card><EmptyState icon={Megaphone} title="No announcements" text="Posted announcements show up on everyone's dashboard." /></Card>
                : announcements.map((a) => (
                  <article key={a.id} className={`ann ann--${a.priority}`}>
                    <div className="ann__top"><h3 className="ann__title">{a.title}</h3><PriorityBadge priority={a.priority} /></div>
                    <p className="ann__body">{a.content}</p>
                    <div className="ann__meta admin__ann-foot"><span>{a.creator_name} · {new Date(a.created_at).toLocaleDateString()}</span>
                      <button type="button" className="members__remove" onClick={() => removeAnnouncement(a)} aria-label={`Delete ${a.title}`}><Trash2 size={15} /></button></div>
                  </article>
                ))}
            </div>
          </div>
        )}
      </div>

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} onDownload={download} />}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { loadUsers(); loadStats() }} />}
      <ConfirmDialog open={!!confirm} danger={confirm?.danger} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
    </div>
  )
}
