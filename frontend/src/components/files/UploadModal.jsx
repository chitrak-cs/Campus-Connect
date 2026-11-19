import { useState, useRef } from 'react'
import { UploadCloud, CheckCircle2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { formatBytes } from '../../utils/format'
import { Modal, Button, Input, Select, Textarea } from '../ui'
import { DEPTS, YEARS, MAX_BYTES, ALLOWED_EXT } from './constants'

export default function UploadModal({ onClose, onUploaded, isPrivileged }) {
  const [form, setForm] = useState({ title: '', subject: '', file_type: 'notes', department: '', year: '', description: '' })
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState(null) // null = idle, 0-100 = uploading
  const [done, setDone] = useState(null)
  const inputRef = useRef(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const busy = progress !== null && !done

  const pick = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) return setFileError('Unsupported type. Use PDF, Word, PowerPoint, JPG or PNG.')
    if (f.size > MAX_BYTES) return setFileError(`File is too large (${formatBytes(f.size)}). Max 50 MB.`)
    setFileError(''); setFile(f)
    if (!form.title) set('title', f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!file) return setFileError('Choose a file to upload')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v))
    fd.append('file', file)
    setProgress(0)
    try {
      const res = await api.post('/files/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
      })
      setDone(res.data.file)
      onUploaded()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
      setProgress(null)
    }
  }

  if (done) {
    return (
      <Modal onClose={onClose} title="Upload complete" size="sm" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="upload-done">
          <CheckCircle2 size={44} aria-hidden="true" />
          <h3>{isPrivileged ? 'Published' : 'Pending approval'}</h3>
          <p>{isPrivileged ? 'Your file is now visible to everyone.' : 'An admin will review your file before it appears in the library. You can track it under "My uploads".'}</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={busy ? undefined : onClose} title="Upload study material" size="md"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" form="upload-form" loading={busy} leftIcon={<UploadCloud size={16} />}>{busy ? `Uploading ${progress}%` : 'Upload'}</Button>
      </>}>
      <form id="upload-form" className="upload-form" onSubmit={submit}>
        <div>
          <div className={`dropzone ${drag ? 'is-drag' : ''} ${fileError ? 'is-error' : ''}`} role="button" tabIndex={0}
            aria-label="Choose a file to upload" onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}>
            <input ref={inputRef} type="file" hidden aria-label="Choose a file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" onChange={(e) => pick(e.target.files[0])} />
            <UploadCloud size={28} aria-hidden="true" />
            {file ? (
              <div className="dropzone__file"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span>
                <button type="button" className="dropzone__clear" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); setFile(null) }}><X size={14} /></button></div>
            ) : (<><strong>Drop a file here or click to browse</strong><span>PDF, Word, PowerPoint, JPG or PNG. Max 50 MB.</span></>)}
          </div>
          {fileError && <p className="ui-field__msg ui-field__msg--error" role="alert">{fileError}</p>}
          {busy && <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}
        </div>
        <Input label="Title" required maxLength={255} placeholder="e.g. Data Structures, Unit 3 notes" value={form.title} onChange={(e) => set('title', e.target.value)} />
        <Input label="Subject" maxLength={150} placeholder="e.g. Data Structures & Algorithms" value={form.subject} onChange={(e) => set('subject', e.target.value)} />
        <div className="upload-form__row">
          <Select label="Type" value={form.file_type} onChange={(e) => set('file_type', e.target.value)}>
            <option value="notes">Notes</option><option value="paper">Exam paper</option><option value="assignment">Assignment</option><option value="other">Other</option>
          </Select>
          <Select label="Department" value={form.department} onChange={(e) => set('department', e.target.value)}>
            <option value="">Select</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </div>
        <Select label="Year" value={form.year} onChange={(e) => set('year', e.target.value)}>
          <option value="">Select</option>{YEARS.map((y) => <option key={y}>{y}</option>)}
        </Select>
        <Textarea label="Description (optional)" maxLength={2000} placeholder="What does this cover?" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </form>
    </Modal>
  )
}
