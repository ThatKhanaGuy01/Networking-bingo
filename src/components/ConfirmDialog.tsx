import { useEffect, useRef } from 'react'

export function ConfirmDialog({ title, description, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelButton.current?.focus() }, [])

  return <div className="dialog-scrim">
    <section className="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}>
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="dialog-actions">
        <button ref={cancelButton} className="button button-quiet" onClick={onCancel}>{cancelLabel}</button>
        <button className="button button-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>
}
