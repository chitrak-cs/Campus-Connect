// Small formatting helpers shared across pages

export const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!n || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// New rows have size_bytes; legacy rows only have a "1.23 MB" string
export const fileSize = (f) => (f.size_bytes ? formatBytes(f.size_bytes) : f.file_size || '')

const EXT_KIND = { pdf: 'pdf', doc: 'doc', docx: 'doc', ppt: 'ppt', pptx: 'ppt', jpg: 'image', jpeg: 'image', png: 'image' }

export const fileExt = (f) => {
  // Try each source in turn: legacy image ids have no extension but their URL does
  for (const src of [f.original_name, f.cloudinary_public_id, f.file_url]) {
    const m = (src || '').split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
    if (m) return m[1].toLowerCase()
  }
  return ''
}
export const fileKind = (f) => EXT_KIND[fileExt(f)] || 'other'

export const FILE_TYPE_LABEL = { notes: 'Notes', paper: 'Paper', assignment: 'Assignment', other: 'Other' }
