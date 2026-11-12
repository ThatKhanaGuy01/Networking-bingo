import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppState } from '../app/AppState'
import { makeActiveCard } from '../app/cardRecords'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AppLayout } from '../components/AppLayout'
import { generateBingoCard, type GridSize } from '../game'

const GRID_SIZES: readonly GridSize[] = [3, 4, 5, 6, 7]

export function RandomSetupPage() {
  const { tasks, taskStatus, activeCard, saveCard } = useAppState()
  const location = useLocation()
  const navigate = useNavigate()
  const [gridSize, setGridSize] = useState<GridSize>(5)
  const [freeCenter, setFreeCenter] = useState(false)
  const [seed, setSeed] = useState('')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [error, setError] = useState('')
  const needed = gridSize * gridSize - (freeCenter ? 1 : 0)
  const enoughTasks = tasks.length >= needed
  const replacementConfirmed = Boolean((location.state as { replacementConfirmed?: boolean } | null)?.replacementConfirmed)

  function beginCard() {
    setError('')
    try {
      const card = generateBingoCard(tasks, {
        gridSize,
        freeCenter,
        seed: seed.trim() === '' ? undefined : seed,
      })
      saveCard(makeActiveCard('random', card))
      navigate('/play', { replace: true, state: null })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not make that card. Try a smaller grid.')
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeCard && !replacementConfirmed) setConfirmReplace(true)
    else beginCard()
  }

  return <AppLayout>
    <div className="page-heading">
      <Link to="/" className="back-link">← Home</Link>
      <h1>Random card</h1>
      <p>Choose a grid size and an optional seed.</p>
    </div>

    <form className="setup-panel" onSubmit={submit}>
      <label className="field-label" htmlFor="grid-size">Board size</label>
      <select id="grid-size" value={gridSize} onChange={(event) => {
        const nextSize = Number(event.target.value) as GridSize
        setGridSize(nextSize)
        if (nextSize % 2 === 0) setFreeCenter(false)
      }}>
        {GRID_SIZES.map((size) => <option key={size} value={size}>{size} × {size}</option>)}
      </select>
      {gridSize % 2 === 1 && <label className="check-field">
        <input type="checkbox" checked={freeCenter} onChange={(event) => setFreeCenter(event.target.checked)} />
        <span className="check-ui" aria-hidden="true" />
        <span>Free centre square</span>
      </label>}
      <label className="field-label" htmlFor="card-seed">Seed <span className="field-optional">optional</span></label>
      <input id="card-seed" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Leave blank for a random seed" autoComplete="off" />
      <p className="field-hint">Use the same seed to generate the same card. Seeds are case-sensitive.</p>

      {taskStatus === 'loading' && <p className="inline-note" role="status">Loading tasks…</p>}
      {taskStatus === 'error' && <p className="inline-error" role="alert">Tasks could not be loaded. Refresh to try again.</p>}
      {!enoughTasks && <div className="inline-error" role="alert">
        <p>This grid needs {needed} tasks, but only {tasks.length} are available.</p>
        {gridSize > 3 && <button type="button" className="text-button" onClick={() => {
          setGridSize((gridSize - 1) as GridSize)
          setFreeCenter(false)
        }}>Try a smaller board</button>}
      </div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="button button-primary button-wide" type="submit" disabled={taskStatus !== 'ready' || !enoughTasks}>
        Create random card
      </button>
    </form>

    {confirmReplace && <ConfirmDialog
      title="Replace your saved card?"
      description="Your current card and checked squares will be replaced with a new random card."
      confirmLabel="Replace card"
      cancelLabel="Keep current card"
      onCancel={() => setConfirmReplace(false)}
      onConfirm={beginCard}
    />}
  </AppLayout>
}
