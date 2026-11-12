import { useEffect, useRef } from 'react'
import type { BingoTask } from '../game'

export function TaskDetailsDialog({ task, onClose }: { task: BingoTask; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeButton.current?.focus() }, [])

  return <div className="dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="dialog-card task-details" role="dialog" aria-modal="true" aria-labelledby="task-details-title" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <p className="eyebrow">Square task</p>
      <h2 id="task-details-title">{task.text}</h2>
      <button ref={closeButton} className="button button-primary" onClick={onClose}>Back to card</button>
    </section>
  </div>
}
