import { FileText, FileImage, Presentation, File } from 'lucide-react'
import { fileKind } from '../utils/format'

const ICONS = { pdf: FileText, doc: FileText, ppt: Presentation, image: FileImage, other: File }

/** Colored tile with an icon matching the file's extension. */
export default function FileTypeIcon({ file, size = 'md' }) {
  const kind = fileKind(file)
  const Icon = ICONS[kind]
  return (
    <span className={`ftype ftype--${kind} ftype--${size}`} aria-hidden="true">
      <Icon size={size === 'lg' ? 26 : 20} />
    </span>
  )
}
