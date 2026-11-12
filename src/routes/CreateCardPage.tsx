import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../app/AppState'
import { makeActiveCard } from '../app/cardRecords'
import { AppLayout } from '../components/AppLayout'
import { BingoGrid } from '../components/BingoGrid'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TaskPicker } from '../components/TaskPicker'
import {
  assignTaskToCell,
  createCustomBingoCard,
  createEmptyPlacements,
  removeTaskFromCell,
  type BingoCell,
  type GridSize,
} from '../game'

const GRID_SIZES: readonly GridSize[] = [3, 4, 5, 6, 7]

export function CreateCardPage() {
  const { tasks, taskStatus, activeCard, saveCard } = useAppState()
  const location = useLocation()
  const navigate = useNavigate()
  const [gridSize, setGridSize] = useState<GridSize>(3)
  const [freeCenter, setFreeCenter] = useState(false)
  const [placements, setPlacements] = useState(() => createEmptyPlacements(3))
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [error, setError] = useState('')
  const replacementConfirmed = Boolean((location.state as { replacementConfirmed?: boolean } | null)?.replacementConfirmed)
  const center = Math.floor(gridSize * gridSize / 2)
  const needed = gridSize * gridSize - (freeCenter ? 1 : 0)
  const placedCount = placements.filter(Boolean).length
  const remaining = needed - placedCount

  const cells = useMemo<BingoCell[]>(() => placements.map((task, index) => {
    const isFree = freeCenter && index === center
    return {
      index,
      row: Math.floor(index / gridSize),
      column: index % gridSize,
      task: isFree ? null : task,
      isFree,
    }
  }), [center, freeCenter, gridSize, placements])

  function changeGridSize(nextSize: GridSize) {
    setGridSize(nextSize)
    setFreeCenter(false)
    setPlacements(createEmptyPlacements(nextSize))
  }

  function changeFreeCenter(enabled: boolean) {
    const next = createEmptyPlacements(gridSize, enabled)
    placements.forEach((task, index) => {
      if (index !== center) next[index] = task
    })
    setFreeCenter(enabled)
    setPlacements(next)
  }

  function playCard() {
    setError('')
    try {
      const card = createCustomBingoCard(placements, gridSize, freeCenter)
      saveCard(makeActiveCard('custom', card))
      navigate('/play', { replace: true, state: null })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fill every square to play this card.')
    }
  }

  function submit() {
    if (remaining > 0) return
    if (activeCard && !replacementConfirmed) setConfirmReplace(true)
    else playCard()
  }

  return <AppLayout>
    <div className="page-heading">
      <Link to="/" className="back-link">← Home</Link>
      <h1>Build your own</h1>
      <p>Choose tasks and place them on your card.</p>
    </div>

    <div className="builder-controls">
      <label className="field-label" htmlFor="builder-size">Board size</label>
      <select id="builder-size" value={gridSize} onChange={(event) => changeGridSize(Number(event.target.value) as GridSize)}>
        {GRID_SIZES.map((size) => <option key={size} value={size}>{size} × {size}</option>)}
      </select>
      {gridSize % 2 === 1 && <label className="check-field compact-check">
        <input type="checkbox" checked={freeCenter} onChange={(event) => changeFreeCenter(event.target.checked)} />
        <span className="check-ui" aria-hidden="true" />
        <span>Free centre square</span>
      </label>}
    </div>

    <div className="builder-layout">
      <section>
        <div className="builder-board-heading">
          <h2>Your board</h2>
          <span className={remaining === 0 ? 'remaining-count is-full' : 'remaining-count'}>
            {remaining === 0 ? 'Ready to play' : remaining + ' square' + (remaining === 1 ? '' : 's') + ' left'}
          </span>
        </div>
        <BingoGrid cells={cells} gridSize={gridSize} mode="build" selectedCellIndex={selectedCell} onSelectCell={setSelectedCell} />
        {remaining > 0 && <p className="field-hint board-hint">Select a square, then choose a task. Select a task already on your card to move it.</p>}
      </section>
    </div>

    {taskStatus === 'loading' && <p className="inline-note" role="status">Loading tasks…</p>}
    {taskStatus === 'error' && <p className="inline-error" role="alert">Tasks could not be loaded. Refresh to try again.</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="builder-footer">
      <Link to="/random" className="text-button">Random card</Link>
      <button className="button button-primary" onClick={submit} disabled={remaining > 0 || taskStatus !== 'ready'}>
        Play card
      </button>
    </div>

    {selectedCell !== null && <TaskPicker
      tasks={tasks}
      placements={placements}
      targetIndex={selectedCell}
      onChoose={(task) => {
        setPlacements((current) => assignTaskToCell(current, selectedCell, task, gridSize, freeCenter))
        setSelectedCell(null)
      }}
      onRemove={() => {
        setPlacements((current) => removeTaskFromCell(current, selectedCell, gridSize, freeCenter))
        setSelectedCell(null)
      }}
      onClose={() => setSelectedCell(null)}
    />}
    {confirmReplace && <ConfirmDialog
      title="Replace your saved card?"
      description="Your current card and checked squares will be replaced with this custom card."
      confirmLabel="Replace card"
      cancelLabel="Keep current card"
      onCancel={() => setConfirmReplace(false)}
      onConfirm={playCard}
    />}
  </AppLayout>
}
