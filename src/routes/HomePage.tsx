import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppState } from '../app/AppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AppLayout } from '../components/AppLayout'

export function HomePage() {
  const { activeCard, taskStatus } = useAppState()
  const navigate = useNavigate()
  const [confirmStart, setConfirmStart] = useState(false)
  const completed = activeCard?.completedCells.filter(Boolean).length ?? 0

  return <AppLayout>
    <section className="home-hero">
      <div className="hero-copy">
        <h1>Networking<br />Bingo</h1>
        <p className="hero-description">Complete tasks on a bingo card. Get a line to win.</p>
        <div className="hero-actions">
          <Link to="/random" className="button button-primary">Random card</Link>
          <Link to="/create" className="button button-secondary">Build your own</Link>
        </div>
      </div>
    </section>

    {activeCard && <section className="resume-panel" aria-label="Saved game">
      <div className="resume-mark" aria-hidden="true">▶</div>
      <div className="resume-copy">
        <p className="eyebrow">Saved card</p>
        <h2>{activeCard.kind === 'random' ? 'Random card' : 'Your custom card'} · {activeCard.card.gridSize}×{activeCard.card.gridSize}</h2>
        <p>{completed} of {activeCard.card.cells.length} squares complete</p>
      </div>
      <div className="resume-actions">
        <Link to="/play" className="button button-primary">Resume card</Link>
        <button className="text-button" onClick={() => setConfirmStart(true)}>New card</button>
      </div>
    </section>}

    <section className="how-section">
      <div><span className="step-dot dot-coral">1</span><strong>Choose a task</strong><p>Select a task from your card.</p></div>
      <div><span className="step-dot dot-blue">2</span><strong>Complete it</strong><p>Complete the task in a square.</p></div>
      <div><span className="step-dot dot-mint">3</span><strong>Mark it complete</strong><p>Complete a line to get bingo.</p></div>
    </section>

    {taskStatus === 'error' && <p className="inline-error" role="alert">Tasks could not be loaded. Refresh to try again.</p>}
    {confirmStart && <ConfirmDialog
      title="Start a new card?"
      description="Your saved card and its progress will be replaced once the new card is ready."
      confirmLabel="Choose a new card"
      cancelLabel="Keep playing"
      onCancel={() => setConfirmStart(false)}
      onConfirm={() => navigate('/random', { state: { replacementConfirmed: true } })}
    />}
  </AppLayout>
}
