import { useState, useEffect } from 'react'
import { Copy, RefreshCw, UserMinus, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import { Modal, Avatar, Badge, Button, Spinner, ConfirmDialog, EmptyState } from '../ui'

export default function MembersModal({ group, onClose, onChanged }) {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState(group.invite_code || null)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    api.get(`/groups/${group.id}/members`).then((res) => setMembers(res.data.members || []))
      .catch(() => toast.error('Could not load members')).finally(() => setLoading(false))
  }, [group.id])

  const me = members.find((m) => m.id === user?.id)
  const canManage = user?.role === 'admin' || me?.role === 'admin'

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { toast.error('Copy failed. Select the code and copy it manually.') }
  }

  const rotate = async () => {
    try {
      const res = await api.post(`/groups/${group.id}/invite-code/rotate`)
      setCode(res.data.invite_code); toast.success('New invite code created. The old one no longer works.'); onChanged?.()
    } catch (err) { toast.error(err.response?.data?.message || 'Could not rotate code') }
    setRotating(false)
  }

  const remove = async () => {
    try {
      await api.delete(`/groups/${group.id}/members/${removing.id}`)
      setMembers((prev) => prev.filter((m) => m.id !== removing.id)); toast.success(`${removing.name} was removed`); onChanged?.()
    } catch (err) { toast.error(err.response?.data?.message || 'Could not remove member') }
    setRemoving(null)
  }

  return (
    <Modal onClose={onClose} title={`${group.name}: members`}>
      {group.is_private && code && canManage && (
        <div className="invite">
          <div>
            <div className="invite__label">Invite code</div>
            <code className="invite__code">{code}</code>
          </div>
          <div className="invite__actions">
            <Button size="sm" variant="secondary" onClick={copy} leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}>{copied ? 'Copied' : 'Copy'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setRotating(true)} leftIcon={<RefreshCw size={14} />}>New code</Button>
          </div>
        </div>
      )}

      {loading ? <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Spinner /></div>
        : members.length === 0 ? <EmptyState title="No members yet" />
        : (
          <ul className="members">
            {members.map((m) => (
              <li key={m.id} className="members__row">
                <Avatar name={m.name} src={m.avatar_url} size="md" />
                <div className="members__main">
                  <div className="members__name">{m.name}{m.id === user?.id && <span className="muted"> (you)</span>}</div>
                  <div className="members__meta">{[m.department, m.year].filter(Boolean).join(' · ') || 'Member'}</div>
                </div>
                {m.is_creator ? <Badge tone="accent">Owner</Badge> : m.role === 'admin' ? <Badge tone="info">Admin</Badge> : null}
                {canManage && !m.is_creator && m.id !== user?.id && (
                  <button type="button" className="members__remove" onClick={() => setRemoving(m)} aria-label={`Remove ${m.name}`}><UserMinus size={16} /></button>
                )}
              </li>
            ))}
          </ul>
        )}

      <ConfirmDialog open={!!removing} danger title="Remove member?" confirmLabel="Remove"
        message={removing ? `${removing.name} will lose access to this group's chat.` : ''} onCancel={() => setRemoving(null)} onConfirm={remove} />
      <ConfirmDialog open={rotating} title="Create a new invite code?" confirmLabel="Create new code"
        message="The current code will stop working. People already in the group stay." onCancel={() => setRotating(false)} onConfirm={rotate} />
    </Modal>
  )
}
