import { useState } from 'react'
import { Globe, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { Modal, Button, Input, Select, Textarea } from '../ui'

const DEPTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'BCA', 'MCA', 'MBA', 'General']

export default function CreateGroupModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', department: '', is_private: false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.name.trim().length < 3) return setError('Group name must be at least 3 characters')
    setSaving(true)
    try {
      const res = await api.post('/groups', { ...form, name: form.name.trim() })
      toast.success(form.is_private ? 'Private group created. Share its invite code from Members.' : 'Study group created')
      onCreated(res.data.group)
      onClose()
    } catch (err) { setError(err.response?.data?.message || 'Failed to create group') } finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} title="Create study group"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="create-group" loading={saving}>Create group</Button></>}>
      <form id="create-group" className="upload-form" onSubmit={submit}>
        <Input label="Group name" required maxLength={100} placeholder="e.g. CSE 3rd Year DBMS" value={form.name} error={error}
          onChange={(e) => { set('name', e.target.value); setError('') }} />
        <Select label="Department" value={form.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All departments</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <Textarea label="Description" maxLength={2000} placeholder="What will this group study?" value={form.description} onChange={(e) => set('description', e.target.value)} />
        <fieldset className="fieldset">
          <legend className="ui-label legend">Privacy</legend>
          <div className="seg">
            {[{ val: false, icon: Globe, label: 'Public', sub: 'Anyone can join' }, { val: true, icon: Lock, label: 'Private', sub: 'Join with an invite code' }].map((o) => (
              <button key={String(o.val)} type="button" className="privacy" aria-pressed={form.is_private === o.val} onClick={() => set('is_private', o.val)}>
                <o.icon size={18} aria-hidden="true" /><strong>{o.label}</strong><span>{o.sub}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
