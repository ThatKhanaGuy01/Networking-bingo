import { useState } from 'react'
import type { BingoCell, BingoLine, BingoTask, GridSize } from '../game'
import { TaskDetailsDialog } from './TaskDetailsDialog'

const tileSizes: Record<GridSize, string> = {
  3: 'clamp(.78rem, 3.6vw, .98rem)',
  4: 'clamp(.68rem, 3vw, .88rem)',
  5: 'clamp(.58rem, 2.6vw, .78rem)',
  6: 'clamp(.52rem, 2.2vw, .7rem)',
  7: 'clamp(.46rem, 1.9vw, .62rem)',
}

export function BingoGrid({ cells, gridSize, completedCells, completedLines = [], selectedCellIndex, mode, onToggle, onSelectCell }: {
  cells: readonly BingoCell[]
  gridSize: GridSize
  completedCells?: readonly boolean[]
  completedLines?: readonly BingoLine[]
  selectedCellIndex?: number | null
  mode: 'play' | 'build'
  onToggle?: (index: number) => void
  onSelectCell?: (index: number) => void
}) {
  const [detailsTask, setDetailsTask] = useState<BingoTask | null>(null)
  const highlightedCells = new Set(completedLines.flatMap((line) => line.cells))
  const gap = gridSize >= 6 ? 'gap-[3px]' : 'gap-1.5'

  return <>
    <div className={'bingo-grid ' + gap} role="group" style={{ gridTemplateColumns: 'repeat(' + gridSize + ', minmax(0, 1fr))', '--tile-font': tileSizes[gridSize] } as React.CSSProperties} aria-label={gridSize + ' by ' + gridSize + ' bingo card'}>
      {cells.map((cell) => {
        const completed = completedCells?.[cell.index] ?? false
        const task = cell.task
        const actionLabel = cell.isFree
          ? 'Free centre square, always complete'
          : mode === 'build'
            ? task ? 'Change square ' + (cell.index + 1) + ': ' + task.text : 'Choose a task for square ' + (cell.index + 1)
            : (completed ? 'Mark incomplete: ' : 'Mark complete: ') + (task?.text ?? 'empty square')
        return <div key={cell.index} className={[
          'bingo-tile',
          completed && mode === 'play' ? 'tile-complete' : '',
          highlightedCells.has(cell.index) ? 'tile-line' : '',
          selectedCellIndex === cell.index ? 'tile-selected' : '',
          cell.isFree ? 'tile-free' : '',
        ].join(' ')}>
          <button
            type="button"
            className="tile-action"
            aria-label={actionLabel}
            aria-pressed={mode === 'play' ? completed : undefined}
            disabled={cell.isFree || (mode === 'play' && !task)}
            onClick={() => mode === 'play' ? onToggle?.(cell.index) : onSelectCell?.(cell.index)}
          >
            {cell.isFree
              ? <><span aria-hidden="true" className="free-spark">✳</span><span>FREE</span></>
              : task
                ? <span className="tile-copy">{task.text}</span>
                : <span className="tile-empty">+<span className="sr-only">Add task</span></span>}
          </button>
          {task && <button type="button" className="tile-info" aria-label={'Read full task: ' + task.text} onClick={() => setDetailsTask(task)}>i</button>}
        </div>
      })}
    </div>
    {detailsTask && <TaskDetailsDialog task={detailsTask} onClose={() => setDetailsTask(null)} />}
  </>
}
