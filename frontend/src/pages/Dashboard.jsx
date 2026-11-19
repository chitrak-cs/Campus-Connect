import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Users, MessageSquare, Download, ArrowRight, Upload, AlertCircle, Megaphone, FolderOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { fileSize } from '../utils/format'
import StatCard from '../components/StatCard'
import FileTypeIcon from '../components/FileTypeIcon'
import { PageHeader, Card, Button, EmptyState, SkeletonList, PriorityBadge } from '../components/ui'
import '../styles/pages/dashboard.css'

const greetingFor = (h) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [data, setData] = useState({ stats: null, mine: [], groups: [], announcements: [], recent: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      isAdmin ? api.get('/admin/stats') : Promise.resolve(null),
      api.get('/files/mine'),
      api.get('/groups'),
      api.get('/announcements'),
      api.get('/files', { params: { limit: 5 } }),
    ]).then(([stats, mine, groups, ann, recent]) => {
      if (cancelled) return
      setData({
        stats: stats?.data || null,
        mine: mine.data.files || [],
        groups: (groups.data.groups || []).filter((g) => g.is_member),
        announcements: ann.data.announcements || [],
        recent: recent.data.files || [],
      })
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAdmin])

  const { stats, mine, groups, announcements, recent } = data
  const myDownloads = mine.reduce((sum, f) => sum + (f.download_count || 0), 0)
  const sub = [user?.department, user?.year].filter(Boolean).join(' · ') || 'Welcome to Campus Connect'

  return (
    <div>
      <PageHeader serif title={`${greetingFor(new Date().getHours())}, ${user?.name?.split(' ')[0] || ''}`} subtitle={sub}
        actions={<Button leftIcon={<Upload size={16} />} onClick={() => navigate('/files', { state: { upload: true } })}>Upload material</Button>} />

      <div className="stat-grid">
        {isAdmin ? (<>
          <StatCard icon={Users} label="Members" value={stats?.users} tone="info" loading={loading} />
          <StatCard icon={FileText} label="Approved files" value={stats?.files} tone="success" loading={loading} />
          <StatCard icon={MessageSquare} label="Messages" value={stats?.messages} tone="accent" loading={loading} />
          <StatCard icon={Download} label="Downloads" value={stats?.downloads} tone="danger" loading={loading} />
        </>) : (<>
          <StatCard icon={Upload} label="My uploads" value={mine.length} tone="info" loading={loading} />
          <StatCard icon={Download} label="Downloads of my files" value={myDownloads} tone="success" loading={loading} />
          <StatCard icon={Users} label="Groups joined" value={groups.length} tone="accent" loading={loading} />
        </>)}
      </div>

      {isAdmin && (stats?.pending > 0 || stats?.pendingRoleRequests > 0) && (
        <button type="button" className="alert alert--danger" onClick={() => navigate('/admin')}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            {[stats.pending > 0 && `${stats.pending} file${stats.pending > 1 ? 's' : ''} pending approval`,
              stats.pendingRoleRequests > 0 && `${stats.pendingRoleRequests} faculty request${stats.pendingRoleRequests > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
          </span>
          <ArrowRight size={14} aria-hidden="true" style={{ marginLeft: 'auto' }} />
        </button>
      )}

      <div className="dash">
        <div className="dash__col">
          <section aria-labelledby="recent-h">
            <div className="section-head">
              <h2 id="recent-h">Recent materials</h2>
              <button type="button" className="link-btn" onClick={() => navigate('/files')}>View all <ArrowRight size={14} aria-hidden="true" /></button>
            </div>
            {loading ? <SkeletonList rows={3} /> : recent.length === 0 ? (
              <Card><EmptyState icon={FolderOpen} title="No files yet" text="Upload study materials and they'll appear here once approved."
                action={<Button onClick={() => navigate('/files', { state: { upload: true } })}>Upload material</Button>} /></Card>
            ) : (
              <div className="stack">
                {recent.map((f) => (
                  <div key={f.id} className="row-card">
                    <FileTypeIcon file={f} />
                    <div className="row-card__main">
                      <div className="row-card__title">{f.title}</div>
                      <div className="row-card__meta">
                        {[f.subject, f.department, f.year].filter(Boolean).join(' · ')}<span className="dot-sep" />by {f.uploader_name}{fileSize(f) && <><span className="dot-sep" />{fileSize(f)}</>}
                      </div>
                    </div>
                    <span className="row-card__meta" title="Downloads"><Download size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {f.download_count}</span>
                    <Button size="sm" variant="secondary" onClick={() => navigate('/files')}>View</Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="groups-h">
            <div className="section-head">
              <h2 id="groups-h">My groups</h2>
              <button type="button" className="link-btn" onClick={() => navigate('/groups')}>Browse groups <ArrowRight size={14} aria-hidden="true" /></button>
            </div>
            {loading ? <SkeletonList rows={2} height={56} /> : groups.length === 0 ? (
              <Card><EmptyState icon={Users} title="You haven't joined a group" text="Join a study group to chat and share with classmates."
                action={<Button variant="secondary" onClick={() => navigate('/groups')}>Find a group</Button>} /></Card>
            ) : (
              <div className="stack">
                {groups.map((g) => (
                  <button key={g.id} type="button" className="row-card" style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                    onClick={() => navigate('/chat', { state: { groupId: g.id } })}>
                    <span className="group-dot" style={{ background: g.avatar_color }}>{g.name[0].toUpperCase()}</span>
                    <div className="row-card__main">
                      <div className="row-card__title">{g.name}</div>
                      <div className="row-card__meta">{g.member_count} member{g.member_count === 1 ? '' : 's'}{g.department ? ` · ${g.department}` : ''}</div>
                    </div>
                    <span className="link-btn">Open chat <ArrowRight size={14} aria-hidden="true" /></span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside aria-labelledby="ann-h">
          <div className="section-head"><h2 id="ann-h">Announcements</h2></div>
          {loading ? <SkeletonList rows={2} height={96} /> : announcements.length === 0 ? (
            <Card><EmptyState icon={Megaphone} title="No announcements" text="Updates from admins will show up here." /></Card>
          ) : (
            <div className="stack">
              {announcements.map((a) => (
                <article key={a.id} className={`ann ann--${a.priority}`}>
                  <div className="ann__top"><h3 className="ann__title">{a.title}</h3><PriorityBadge priority={a.priority} /></div>
                  <p className="ann__body">{a.content}</p>
                  <div className="ann__meta">{a.creator_name} · {new Date(a.created_at).toLocaleDateString()}</div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
