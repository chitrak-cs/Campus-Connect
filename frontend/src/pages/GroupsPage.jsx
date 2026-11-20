import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Users, Lock, Globe, Search, MessageSquare, KeyRound, Trash2, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import CreateGroupModal from '../components/groups/CreateGroupModal'
import MembersModal from '../components/groups/MembersModal'
import { PageHeader, Button, Badge, EmptyState, SkeletonList, ConfirmDialog, Card } from '../components/ui'
import '../styles/pages/groups.css'

function GroupCard({ g, userId, isSiteAdmin, onOpen, onMembers, onJoin, onLeave, onDelete }) {
  const owner = g.created_by === userId
  return (
    <article className="gcard">
      <div className="gcard__strip" style={{ background: g.avatar_color }} />
      <div className="gcard__body">
        <div className="gcard__head">
          <span className="gcard__avatar" style={{ background: g.avatar_color }} aria-hidden="true">{g.name.slice(0, 2).toUpperCase()}</span>
          <div className="gcard__title">
            <h3 title={g.name}>{g.name}</h3>
            <p>{g.is_private ? <><Lock size={12} aria-hidden="true" /> Private</> : <><Globe size={12} aria-hidden="true" /> Public</>}{g.department && ` · ${g.department}`}</p>
          </div>
          {g.is_member && <Badge tone="success">Joined</Badge>}
        </div>
        {g.description && <p className="gcard__desc">{g.description}</p>}
        <div className="gcard__foot">
          <span className="gcard__count"><Users size={14} aria-hidden="true" /> {g.member_count} member{g.member_count === 1 ? '' : 's'}</span>
          <div className="gcard__actions">
            {g.is_member ? (
              <>
                <Button size="sm" leftIcon={<MessageSquare size={14} />} onClick={() => onOpen(g)}>Open chat</Button>
                <Button size="sm" variant="secondary" onClick={() => onMembers(g)}>Members</Button>
                {!owner && <Button size="sm" variant="ghost" onClick={() => onLeave(g)} aria-label={`Leave ${g.name}`} leftIcon={<LogOut size={14} />}>Leave</Button>}
              </>
            ) : (
              <Button size="sm" onClick={() => onJoin(g)}>Join group</Button>
            )}
            {(owner || isSiteAdmin) && <Button size="sm" variant="ghost" className="gcard__danger" onClick={() => onDelete(g)} aria-label={`Delete ${g.name}`}><Trash2 size={14} /></Button>}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function GroupsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(location.state?.search || '')
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [membersOf, setMembersOf] = useState(null)
  const [confirm, setConfirm] = useState(null) // { kind: 'leave' | 'delete', group }

  const load = useCallback(async () => {
    try { const res = await api.get('/groups'); setGroups(res.data.groups || []) }
    catch { toast.error('Failed to load groups') } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const join = async (g) => {
    try { await api.post(`/groups/${g.id}/join`); toast.success(`You joined ${g.name}`); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to join') }
  }

  const joinByCode = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    try { await api.post('/groups/join-by-code', { code: code.trim() }); toast.success('You joined the group'); setCode(''); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Invalid invite code') } finally { setJoining(false) }
  }

  const runConfirm = async () => {
    const { kind, group } = confirm
    try {
      if (kind === 'leave') { await api.delete(`/groups/${group.id}/leave`); toast.success(`You left ${group.name}`) }
      else { await api.delete(`/groups/${group.id}`); toast.success('Group deleted') }
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
    setConfirm(null)
  }

  const q = search.trim().toLowerCase()
  const filtered = groups.filter((g) => !q || [g.name, g.description, g.department].some((v) => v?.toLowerCase().includes(q)))
  const mine = filtered.filter((g) => g.is_member)
  const others = filtered.filter((g) => !g.is_member)
  const cardProps = {
    userId: user?.id, isSiteAdmin: user?.role === 'admin',
    onOpen: (g) => navigate('/chat', { state: { groupId: g.id } }), onMembers: setMembersOf, onJoin: join,
    onLeave: (group) => setConfirm({ kind: 'leave', group }), onDelete: (group) => setConfirm({ kind: 'delete', group }),
  }

  return (
    <div>
      <PageHeader title="Study groups" subtitle="Create or join groups to learn together"
        actions={<Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New group</Button>} />

      <div className="gtools">
        <label className="ftools__search">
          <Search size={16} aria-hidden="true" /><span className="sr-only">Search groups</span>
          <input type="search" placeholder="Search groups" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <form className="gcode" onSubmit={joinByCode}>
          <KeyRound size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="invite-code">Invite code</label>
          <input id="invite-code" placeholder="Have an invite code?" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" size="sm" variant="secondary" loading={joining} disabled={!code.trim()}>Join</Button>
        </form>
      </div>

      {loading ? <SkeletonList rows={3} height={150} /> : filtered.length === 0 ? (
        <Card><EmptyState icon={Users} title={q ? 'No groups match your search' : 'No groups yet'} text={q ? 'Try a different search.' : 'Create a study group and invite your classmates.'}
          action={!q && <Button onClick={() => setShowCreate(true)}>Create group</Button>} /></Card>
      ) : (
        <>
          {mine.length > 0 && (
            <section aria-labelledby="mine-h" className="gsection">
              <h2 id="mine-h">My groups <span>{mine.length}</span></h2>
              <div className="ggrid">{mine.map((g) => <GroupCard key={g.id} g={g} {...cardProps} />)}</div>
            </section>
          )}
          {others.length > 0 && (
            <section aria-labelledby="discover-h" className="gsection">
              <h2 id="discover-h">Discover <span>{others.length}</span></h2>
              <div className="ggrid">{others.map((g) => <GroupCard key={g.id} g={g} {...cardProps} />)}</div>
            </section>
          )}
        </>
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {membersOf && <MembersModal group={membersOf} onClose={() => setMembersOf(null)} onChanged={load} />}
      <ConfirmDialog open={!!confirm} danger title={confirm?.kind === 'leave' ? 'Leave this group?' : 'Delete this group?'}
        confirmLabel={confirm?.kind === 'leave' ? 'Leave' : 'Delete'}
        message={confirm?.kind === 'leave' ? `You'll stop receiving messages from ${confirm?.group.name}.` : `"${confirm?.group.name}" and all its messages will be permanently deleted.`}
        onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
    </div>
  )
}
