import { Download, ExternalLink, FileX } from 'lucide-react'
import { fileKind } from '../../utils/format'
import { Modal, Button, EmptyState } from '../ui'

/** Images inline, PDFs in an iframe. Other types: download only. Previewing doesn't count as a download. */
export default function PreviewModal({ file, onClose, onDownload }) {
  const kind = fileKind(file)
  return (
    <Modal onClose={onClose} title={file.title} size="xl"
      footer={<>
        {(kind === 'pdf' || kind === 'image') && (
          <a href={file.file_url} target="_blank" rel="noopener noreferrer"><Button variant="secondary" leftIcon={<ExternalLink size={16} />}>Open in new tab</Button></a>
        )}
        <Button leftIcon={<Download size={16} />} onClick={() => onDownload(file)}>Download</Button>
      </>}>
      {kind === 'image' && <img className="preview__img" src={file.file_url} alt={file.title} />}
      {kind === 'pdf' && <iframe className="preview__frame" src={file.file_url} title={`Preview of ${file.title}`} />}
      {kind !== 'image' && kind !== 'pdf' && (
        <EmptyState icon={FileX} title="Preview not available" text="Word and PowerPoint files can't be previewed in the browser. Download it to open it." />
      )}
    </Modal>
  )
}
