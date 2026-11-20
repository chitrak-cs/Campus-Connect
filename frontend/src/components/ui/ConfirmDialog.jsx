import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'

/** Replaces window.confirm. onConfirm may be async; the dialog closes when it resolves. */
export default function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try { await onConfirm?.() } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={run} loading={busy}>{confirmLabel}</Button>
      </>}>
      <p className="ui-confirm__msg">{message}</p>
    </Modal>
  )
}
