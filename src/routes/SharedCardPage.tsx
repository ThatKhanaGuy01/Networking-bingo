import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSharedCard } from '../api/client'
import { useAppState } from '../app/AppState'
import { makeActiveCard, sameCardIdentity } from '../app/cardRecords'
import { AppLayout } from '../components/AppLayout'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { BingoCard } from '../game'
import type { SharedCardResponse } from '../../shared/types'

export function SharedCardPage({ id }: { id: string }) {
  const { activeCard, saveCard } = useAppState()
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<SharedCardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    let current = true
    getSharedCard(id).then((result) => {
      if (current) setSnapshot(result)
    }).catch((cause) => {
      if (current) setError(cause instanceof Error ? cause.message : 'Could not load this card.')
    }).finally(() => {
      if (current) setLoading(false)
    })
    return () => { current = false }
  }, [id])

  function openCard() {
    if (!snapshot) return
    const card: BingoCard = {
      seed: null,
      gridSize: snapshot.gridSize,
      freeCenter: snapshot.freeCenter,
      cells: snapshot.cells,
    }
    if (activeCard && !sameCardIdentity(activeCard, 'custom', card) && !confirmOpen) {
      setConfirmOpen(true)
      return
    }
    if (!activeCard || !sameCardIdentity(activeCard, 'custom', card)) saveCard(makeActiveCard('custom', card))
    setConfirmOpen(false)
    navigate('/play', { replace: true })
  }

  return <AppLayout>
    {loading
      ? <p role="status" className="loading-card">Loading shared card…</p>
      : error || !snapshot
        ? <section className="empty-card-state">
          <h1>Shared card unavailable</h1>
          <p>{error || 'This card could not be found.'}</p>
          <Link className="button button-primary" to="/">Home</Link>
        </section>
        : <section className="shared-card-page">
          <Link to="/" className="back-link">← Home</Link>
          <h1>{snapshot.title}</h1>
          <p>{snapshot.gridSize} × {snapshot.gridSize} card · {snapshot.cells.filter((cell) => cell.task).length} tasks</p>
          <ol className="shared-task-list">
            {snapshot.cells.map((cell) => <li key={cell.index}>{cell.isFree ? 'Free centre square' : cell.task?.text}</li>)}
          </ol>
          <button className="button button-primary" onClick={openCard}>Open card</button>
        </section>}
    {confirmOpen && snapshot && <ConfirmDialog
      title="Replace your current card?"
      description="Your saved card and progress will be replaced. The shared card starts unmarked."
      confirmLabel="Open shared card"
      cancelLabel="Keep current card"
      onCancel={() => setConfirmOpen(false)}
      onConfirm={openCard}
    />}
  </AppLayout>
}
