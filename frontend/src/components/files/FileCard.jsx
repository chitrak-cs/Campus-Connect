import { Eye, Download, Bookmark, BookmarkCheck, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fileSize, FILE_TYPE_LABEL } from '../../utils/format'
import FileTypeIcon from '../FileTypeIcon'
import { Badge, StatusBadge, DropdownMenu } from '../ui'

export default function FileCard({ file, view, canManage, showStatus, onPreview, onDownload, onToggleSave, onEdit, onDelete }) {
  const size = fileSize(file)
  return (
    <article className={`fcard fcard--${view}`}>
      <div className="fcard__top">
        <FileTypeIcon file={file} size="lg" />
        <div className="fcard__head">
          <h3 className="fcard__title" title={file.title}>{file.title}</h3>
          <p className="fcard__subject">{file.subject || FILE_TYPE_LABEL[file.file_type]}</p>
        </div>
      </div>

      <div className="fcard__badges">
        {showStatus && <StatusBadge approved={file.is_approved} />}
        <Badge tone="accent">{FILE_TYPE_LABEL[file.file_type] || 'File'}</Badge>
        {file.department && <Badge>{file.department}</Badge>}
        {file.year && <Badge>{file.year}</Badge>}
      </div>

      <p className="fcard__meta">
        {file.uploader_name}<span className="dot-sep" />{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
        {size && <><span className="dot-sep" />{size}</>}
        <span className="dot-sep" /><Download size={12} aria-hidden="true" style={{ verticalAlign: '-1px' }} /> {file.download_count}
      </p>

      <div className="fcard__actions">
        <button type="button" className="fbtn" onClick={() => onPreview(file)}><Eye size={15} aria-hidden="true" /> Preview</button>
        <button type="button" className="fbtn fbtn--primary" onClick={() => onDownload(file)}><Download size={15} aria-hidden="true" /> Download</button>
        {file.is_approved && (
          <button type="button" className={`fbtn fbtn--icon ${file.is_bookmarked ? 'is-saved' : ''}`} onClick={() => onToggleSave(file)}
            aria-pressed={!!file.is_bookmarked} aria-label={file.is_bookmarked ? `Remove ${file.title} from saved` : `Save ${file.title}`}>
            {file.is_bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        )}
        {canManage && (
          <DropdownMenu label={`More actions for ${file.title}`}
            trigger={({ props }) => <button type="button" className="fbtn fbtn--icon" {...props}><MoreVertical size={16} /></button>}
            items={[
              { label: 'Edit details', icon: Pencil, onClick: () => onEdit(file) },
              { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(file) },
            ]} />
        )}
      </div>
    </article>
  )
}
