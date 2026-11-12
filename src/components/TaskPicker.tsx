import { useMemo, useState } from 'react'
import type { BingoTask } from '../game'
import type { CustomPlacements } from '../game/custom'

export function TaskPicker({ tasks, placements, targetIndex, onChoose, onClose, onRemove }: {
  tasks: readonly BingoTask[]
  placements: CustomPlacements
  targetIndex: number
  onChoose: (task: BingoTask) => void
  onClose: () => void
  onRemove?: () => void
}) {
  const [query, setQuery] = useState('')
  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? tasks.filter((task) => task.text.toLowerCase().includes(needle)) : tasks
  }, [query, tasks])

  return <div className="dialog-scrim picker-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="dialog-card task-picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <div className="picker-heading">
        <div><p className="eyebrow">Square {targetIndex + 1}</p><h2 id="picker-title">Choose a task</h2></div>
        <button className="icon-button" aria-label="Close task picker" onClick={onClose}>×</button>
      </div>
      <label className="search-label">Search tasks
        <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “travel” or “food”" />
      </label>
      {placements[targetIndex] && <button className="remove-prompt" onClick={onRemove}>Remove task from this square</button>}
      <ul className="task-options">
        {filteredTasks.map((task) => {
          const usedAt = placements.findIndex((placed) => placed?.id === task.id)
          return <li key={task.id}>
            <button className="task-option" onClick={() => onChoose(task)}>
              <span>{task.text}</span>
              <span className={usedAt >= 0 ? 'task-used' : 'task-available'}>
                {usedAt === targetIndex ? 'In this square' : usedAt >= 0 ? 'Move from square ' + (usedAt + 1) : 'Add'}
              </span>
            </button>
          </li>
        })}
        {filteredTasks.length === 0 && <li className="task-empty">No tasks found. Try another search.</li>}
      </ul>
    </section>
  </div>
}
