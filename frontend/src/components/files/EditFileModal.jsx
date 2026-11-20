import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { Modal, Button, Input, Select, Textarea } from '../ui'
import { DEPTS, YEARS } from './constants'

export default function EditFileModal({ file, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: file.title || '', subject: file.subject || '', file_type: file.file_type || 'notes',
    department: file.department || '', year: file.year || '', description: file.description || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put(`/files/${file.id}`, form)
      toast.success('Details updated')
      onSaved(res.data.file)
      onClose()
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save changes') }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} title="Edit details"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="edit-file" loading={saving}>Save changes</Button></>}>
      <form id="edit-file" className="upload-form" onSubmit={save}>
        <Input label="Title" required maxLength={255} value={form.title} onChange={(e) => set('title', e.target.value)} />
        <Input label="Subject" maxLength={150} value={form.subject} onChange={(e) => set('subject', e.target.value)} />
        <div className="upload-form__row">
          <Select label="Type" value={form.file_type} onChange={(e) => set('file_type', e.target.value)}>
            <option value="notes">Notes</option><option value="paper">Exam paper</option><option value="assignment">Assignment</option><option value="other">Other</option>
          </Select>
          <Select label="Department" value={form.department} onChange={(e) => set('department', e.target.value)}>
            <option value="">None</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </div>
        <Select label="Year" value={form.year} onChange={(e) => set('year', e.target.value)}>
          <option value="">None</option>{YEARS.map((y) => <option key={y}>{y}</option>)}
        </Select>
        <Textarea label="Description" maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </form>
    </Modal>
  )
}
