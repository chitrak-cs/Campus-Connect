import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Upload, Search, LayoutGrid, List, FolderOpen, Bookmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import FileCard from '../components/files/FileCard'
import UploadModal from '../components/files/UploadModal'
import PreviewModal from '../components/files/PreviewModal'
import EditFileModal from '../components/files/EditFileModal'
import { TYPES, DEPTS, YEARS } from '../components/files/constants'
import { PageHeader, Button, Tabs, Select, EmptyState, SkeletonList, ConfirmDialog } from '../components/ui'
import '../styles/pages/files.css'

const readView = () => { try { return localStorage.getItem('cc_files_view') === 'list' ? 'list' : 'grid' } catch { return 'grid' } }

export default function FilesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isPrivileged = ['admin', 'faculty'].includes(user?.role)

  const [tab, setTab] = useState('all')
  const [view, setView] = useState(readView)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [type, setType] = useState('')
  const [dept, setDept] = useState('')
  const [year, setYear] = useState('')
  const [sort, setSort] = useState('new')

  const [files, setFiles] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [showUpload, setShowUpload] = useState(!!location.state?.upload)
  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Opened from the dashboard's "Upload material": consume the navigation state
  useEffect(() => { if (location.state?.upload) navigate('/files', { replace: true, state: null }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem('cc_files_view', view) } catch { /* ignore */ } }, [view])
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 400); return () => clearTimeout(t) }, [search])

  // One fetch effect for tab, filters, sort, search and manual reloads
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const req = tab === 'all'
      ? api.get('/files', { params: { search: debounced || undefined, type: type || undefined, dept: dept || undefined, year: year || undefined, sort, page: 1, limit: 20 } })
      : api.get(tab === 'mine' ? '/files/mine' : '/files/saved')
    req.then((res) => {
      if (cancelled) return
      setFiles(res.data.files || []); setPage(1); setPages(res.data.pages || 1)
    }).catch(() => { if (!cancelled) toast.error('Failed to load files') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab, debounced, type, dept, year, sort, reloadKey])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await api.get('/files', { params: { search: debounced || undefined, type: type || undefined, dept: dept || undefined, year: year || undefined, sort, page: page + 1, limit: 20 } })
      setFiles((prev) => [...prev, ...(res.data.files || [])]); setPage(page + 1)
    } catch { toast.error('Could not load more') } finally { setLoadingMore(false) }
  }

  // My uploads / Saved are small lists: filter them in the browser
  const visible = useMemo(() => {
    if (tab === 'all') return files
    const q = debounced.toLowerCase()
    return files.filter((f) =>
      (!q || f.title.toLowerCase().includes(q) || (f.subject || '').toLowerCase().includes(q)) &&
      (!type || f.file_type === type) && (!dept || f.department === dept) && (!year || f.year === year))
  }, [files, tab, debounced, type, dept, year])

  const patchFile = useCallback((id, patch) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))), [])

  const handleDownload = async (f) => {
    try {
      const res = await api.post(`/files/${f.id}/download`)
      window.open(res.data.url, '_blank', 'noopener')
      patchFile(f.id, { download_count: (f.download_count || 0) + 1 })
    } catch { toast.error('Download failed') }
  }

  const toggleSave = async (f) => {
    const next = !f.is_bookmarked
    patchFile(f.id, { is_bookmarked: next })           // optimistic
    try {
      await (next ? api.post(`/files/${f.id}/bookmark`) : api.delete(`/files/${f.id}/bookmark`))
      if (!next && tab === 'saved') setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } catch { patchFile(f.id, { is_bookmarked: !next }); toast.error('Could not update saved files') }
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/files/${deleting.id}`)
      setFiles((prev) => prev.filter((f) => f.id !== deleting.id)); toast.success('File deleted')
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed') }
    setDeleting(null)
  }

  const filtersActive = !!(debounced || type || dept || year)
  const clearFilters = () => { setSearch(''); setType(''); setDept(''); setYear('') }
  const emptyCopy = {
    all: { title: filtersActive ? 'No files match your filters' : 'No files yet', text: filtersActive ? 'Try removing a filter or searching for something else.' : 'Be the first to share study material.' },
    mine: { title: filtersActive ? 'No uploads match your filters' : "You haven't uploaded anything", text: 'Files you upload appear here, including ones waiting for approval.' },
    saved: { title: filtersActive ? 'No saved files match' : 'Nothing saved yet', text: 'Tap the bookmark on a file to keep it here for later.' },
  }[tab]

  return (
    <div>
      <PageHeader title="Files" subtitle="Notes, papers and assignments shared by your campus"
        actions={<Button leftIcon={<Upload size={16} />} onClick={() => setShowUpload(true)}>Upload material</Button>} />

      <Tabs label="File lists" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All files' }, { id: 'mine', label: 'My uploads' }, { id: 'saved', label: 'Saved' }]} />

      <div className="ftools" role="search">
        <label className="ftools__search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search files</span>
          <input type="search" placeholder="Search by title or subject" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="ftools__chips" role="group" aria-label="File type">
          {TYPES.map((t) => <button key={t.value} type="button" className={`chip ${type === t.value ? 'is-active' : ''}`} aria-pressed={type === t.value} onClick={() => setType(t.value)}>{t.label}</button>)}
        </div>
        <div className="ftools__selects">
          <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</Select>
          <Select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</Select>
          {tab === 'all' && <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Newest</option><option value="downloads">Most downloaded</option></Select>}
          <div className="vtoggle" role="group" aria-label="Layout">
            <button type="button" aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setView('grid')}><LayoutGrid size={16} /></button>
            <button type="button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')}><List size={16} /></button>
          </div>
        </div>
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {loading ? <SkeletonList rows={4} height={view === 'grid' ? 150 : 84} /> : visible.length === 0 ? (
          <EmptyState icon={tab === 'saved' ? Bookmark : FolderOpen} title={emptyCopy.title} text={emptyCopy.text}
            action={filtersActive ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : tab !== 'saved' && <Button onClick={() => setShowUpload(true)}>Upload material</Button>} />
        ) : (
          <>
            <p className="fcount" aria-live="polite">{visible.length} file{visible.length === 1 ? '' : 's'}</p>
            <div className={`fgrid fgrid--${view}`}>
              {visible.map((f) => (
                <FileCard key={f.id} file={f} view={view} showStatus={tab === 'mine'}
                  canManage={user?.role === 'admin' || f.uploaded_by === user?.id}
                  onPreview={setPreview} onDownload={handleDownload} onToggleSave={toggleSave} onEdit={setEditing} onDelete={setDeleting} />
              ))}
            </div>
            {tab === 'all' && page < pages && (
              <div className="fmore"><Button variant="secondary" loading={loadingMore} onClick={loadMore}>Load more</Button></div>
            )}
          </>
        )}
      </div>

      {showUpload && <UploadModal isPrivileged={isPrivileged} onClose={() => setShowUpload(false)} onUploaded={() => setReloadKey((k) => k + 1)} />}
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} onDownload={handleDownload} />}
      {editing && <EditFileModal file={editing} onClose={() => setEditing(null)} onSaved={(updated) => patchFile(updated.id, updated)} />}
      <ConfirmDialog open={!!deleting} danger title="Delete this file?" confirmLabel="Delete"
        message={deleting ? `"${deleting.title}" will be permanently removed and can't be recovered.` : ''}
        onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
    </div>
  )
}
