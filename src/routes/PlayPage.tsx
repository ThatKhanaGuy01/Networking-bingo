import confetti from 'canvas-confetti'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppState } from '../app/AppState'
import { makeActiveCard, sameCardIdentity } from '../app/cardRecords'
import { createSharedCard, sharedCardUrl } from '../api/client'
import { AppLayout } from '../components/AppLayout'
import { BingoGrid } from '../components/BingoGrid'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { generateBingoCard, getCompletedLines, toggleCell, type BingoCard, type GameState, type GridSize } from '../game'
import { createGameState } from '../game'

type IncomingCard = { card: BingoCard; error: null } | { card: null; error: string } | null

export function PlayPage() {
  const { tasks, taskStatus, activeCard, saveCard } = useAppState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState('')
  const [confirm, setConfirm] = useState<'replace' | 'reset' | 'open-shared' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const shareInput = useRef<HTMLInputElement>(null)
  const query = params.toString()

  const incoming: IncomingCard = useMemo(() => {
    const values = new URLSearchParams(query)
    if (!values.has('size') && !values.has('seed') && !values.has('free')) return null
    const size = Number(values.get('size'))
    const seed = values.get('seed')
    if (!Number.isInteger(size) || size < 3 || size > 7 || !seed) {
      return { card: null, error: 'This random card link is incomplete or invalid.' }
    }
    const freeCenter = values.get('free') === '1'
    if (freeCenter && size % 2 === 0) return { card: null, error: 'This card link asks for a free centre on an even board.' }
    try {
      const card = generateBingoCard(tasks, { gridSize: size as GridSize, seed, freeCenter })
      return { card, error: null }
    } catch (cause) {
      return { card: null, error: cause instanceof Error ? cause.message : 'We could not open this card.' }
    }
  }, [query, tasks])

  const isSameIncoming = Boolean(activeCard && incoming?.card && sameCardIdentity(activeCard, 'random', incoming.card))

  useEffect(() => {
    if (taskStatus === 'ready' && !activeCard && incoming?.card) {
      saveCard(makeActiveCard('random', incoming.card))
    }
  }, [activeCard, incoming, saveCard, taskStatus])

  const gameState: GameState | null = activeCard
    ? { card: activeCard.card, completedCells: activeCard.completedCells }
    : null
  const completedLines = gameState ? getCompletedLines(gameState) : []
  const completedCount = activeCard?.completedCells.filter(Boolean).length ?? 0
  const cellCount = activeCard?.card.cells.length ?? 0

  function celebrate(transition: ReturnType<typeof toggleCell>) {
    if (!transition.celebration) return
    if (transition.celebration.type === 'full-card') {
      setAnnouncement('Card complete.')
      confetti({
        particleCount: 180,
        spread: 110,
        startVelocity: 52,
        colors: ['#ff725e', '#ffd25f', '#6ab7ff', '#5ad7b5', '#a992f5'],
        disableForReducedMotion: true,
      })
    } else {
      setAnnouncement('')
      confetti({
        particleCount: 55,
        spread: 68,
        startVelocity: 34,
        colors: ['#ff725e', '#ffd25f', '#6ab7ff', '#5ad7b5'],
        disableForReducedMotion: true,
      })
    }
  }

  function markCell(index: number) {
    if (!activeCard || !gameState) return
    const transition = toggleCell(gameState, index)
    setAnnouncement('')
    saveCard({ ...activeCard, completedCells: transition.state.completedCells })
    celebrate(transition)
  }

  function createShareUrl(card: BingoCard): string {
    const search = new URLSearchParams({ size: String(card.gridSize), seed: card.seed ?? '' })
    if (card.freeCenter) search.set('free', '1')
    return window.location.origin + '/play?' + search.toString()
  }

  async function createCustomShareUrl() {
    if (!activeCard || activeCard.kind !== 'custom') return
    setShareBusy(true)
    setShareMessage('')
    try {
      const created = await createSharedCard({
        gridSize: activeCard.card.gridSize,
        freeCenter: activeCard.card.freeCenter,
        cells: activeCard.card.cells.map((cell) => cell.task ? { taskId: cell.task.id } : null),
      })
      setShareUrl(sharedCardUrl(created.id))
    } catch (cause) {
      setShareMessage(cause instanceof Error ? cause.message : 'Could not create the share link.')
    } finally {
      setShareBusy(false)
    }
  }

  async function copyShareUrl() {
    if (!activeCard) return
    const url = activeCard.kind === 'random' ? createShareUrl(activeCard.card) : shareUrl
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setShareMessage('Link copied.')
    } catch {
      shareInput.current?.select()
      setShareMessage('Select the link and copy it to share.')
    }
  }

  function resetProgress() {
    if (!activeCard) return
    const freshState = createGameState(activeCard.card)
    saveCard({ ...activeCard, completedCells: freshState.completedCells })
    setAnnouncement('')
    setConfirm(null)
  }

  function openSharedCard(card: BingoCard) {
    if (activeCard && !sameCardIdentity(activeCard, 'random', card)) {
      setConfirm('open-shared')
      return
    }
    if (!activeCard) saveCard(makeActiveCard('random', card))
    setConfirm(null)
    navigate('/play', { replace: true })
  }

  function acceptIncoming() {
    if (!incoming?.card) return
    saveCard(makeActiveCard('random', incoming.card))
    setConfirm(null)
    navigate('/play', { replace: true })
  }

  function confirmReplace() {
    setConfirm(null)
    navigate('/random', { state: { replacementConfirmed: true } })
  }

  if (taskStatus === 'loading' && !activeCard) {
    return <AppLayout><p role="status" className="loading-card">Getting your card ready…</p></AppLayout>
  }

  if (!activeCard && incoming?.error) {
    return <AppLayout>
      <section className="empty-card-state">
        <p className="eyebrow">Card link</p><h1>We couldn’t open this card.</h1>
        <p>{incoming.error}</p><Link className="button button-primary" to="/random">Make a new card</Link>
      </section>
    </AppLayout>
  }

  if (!activeCard && incoming?.card) {
    return <AppLayout><p role="status" className="loading-card">Opening your shared card…</p></AppLayout>
  }

  if (!activeCard || !gameState) {
    return <AppLayout>
      <section className="empty-card-state">
        {taskStatus === 'error' && <p className="inline-error" role="alert">Tasks could not be loaded. Refresh to try again.</p>}
        <div className="empty-mark" aria-hidden="true">✳</div>
        <h1>No card saved</h1>
        <p>Create a random card or build your own.</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/random">Random card</Link>
          <Link className="button button-secondary" to="/create">Build your own</Link>
        </div>
      </section>
    </AppLayout>
  }

  return <AppLayout>
    {incoming?.error && <p className="inline-error" role="alert">{incoming.error}</p>}
    {incoming?.card && !isSameIncoming && <section className="shared-card-notice" role="status">
      <div><strong>A shared card is ready</strong><p>Your current card is still saved. Open the shared card to switch.</p></div>
      <button className="button button-small button-secondary" onClick={() => openSharedCard(incoming.card!)}>Open shared card</button>
    </section>}
    <div className="play-heading">
      <div>
        <Link to="/" className="back-link">← Home</Link>
        <p className="eyebrow">{activeCard.kind === 'random' ? 'Random card' : 'Custom card'}</p>
        <h1>Bingo card</h1>
      </div>
      <div className="progress-stamp" aria-label={completedCount + ' of ' + cellCount + ' squares complete'}>
        <strong>{completedCount}<span>/{cellCount}</span></strong><small>checked</small>
      </div>
    </div>

    <div className="progress-track" role="progressbar" aria-label="Card progress" aria-valuemin={0} aria-valuemax={cellCount} aria-valuenow={completedCount}>
      <span style={{ width: (completedCount / cellCount * 100) + '%' }} />
    </div>

    {activeCard.kind === 'random' && activeCard.card.seed !== null && <div className="seed-strip">
      <span>Card seed</span><code>{activeCard.card.seed}</code>
    </div>}
    {announcement && <div className={announcement.startsWith('Full card') ? 'celebration-message full-win' : 'celebration-message'} role="status" aria-live="polite">
      {announcement}
    </div>}

    <BingoGrid
      cells={activeCard.card.cells}
      gridSize={activeCard.card.gridSize}
      completedCells={activeCard.completedCells}
      completedLines={completedLines}
      mode="play"
      onToggle={markCell}
    />

    <div className="play-controls">
      <button className="button button-secondary" onClick={() => { setShareMessage(''); setShareUrl(''); setShareOpen(true) }}>Share</button>
      <button className="button button-quiet" onClick={() => setConfirm('reset')}>Reset progress</button>
      <button className="button button-primary" onClick={() => setConfirm('replace')}>New card</button>
    </div>

    {shareOpen && <div className="dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false) }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="share-title" onKeyDown={(event) => { if (event.key === 'Escape') setShareOpen(false) }}>
        <div className="picker-heading"><h2 id="share-title">Share this card</h2><button className="icon-button" aria-label="Close share dialog" onClick={() => setShareOpen(false)}>×</button></div>
        <p>{activeCard.kind === 'random'
          ? 'The link opens a new card with the same tasks. Progress stays on this device.'
          : 'Create a shared snapshot of this card. Recipients start with no progress.'}</p>
        {activeCard.kind === 'custom' && !shareUrl && <button className="button button-primary button-wide" disabled={shareBusy} onClick={() => void createCustomShareUrl()}>
          {shareBusy ? 'Creating link…' : 'Create share link'}
        </button>}
        {(activeCard.kind === 'random' || shareUrl) && <>
          <label className="field-label" htmlFor="share-url">Share link</label>
          <input ref={shareInput} id="share-url" readOnly value={activeCard.kind === 'random' ? createShareUrl(activeCard.card) : shareUrl} onFocus={(event) => event.currentTarget.select()} />
          <button className="button button-primary button-wide" onClick={copyShareUrl}>Copy link</button>
        </>}
        {shareMessage && <p className="inline-note" role="status">{shareMessage}</p>}
      </section>
    </div>}

    {confirm === 'reset' && <ConfirmDialog
      title="Reset checked squares?"
      description="Your card arrangement will stay the same, but all progress will be cleared."
      confirmLabel="Reset progress"
      cancelLabel="Keep playing"
      onCancel={() => setConfirm(null)}
      onConfirm={resetProgress}
    />}
    {confirm === 'replace' && <ConfirmDialog
      title="Start a new card?"
      description="Your current card and checked squares will be replaced after you make the next card."
      confirmLabel="Choose a new card"
      cancelLabel="Keep playing"
      onCancel={() => setConfirm(null)}
      onConfirm={confirmReplace}
    />}
    {confirm === 'open-shared' && <ConfirmDialog
      title="Open the shared card?"
      description="Your current card and progress will be replaced. The shared card starts fresh."
      confirmLabel="Open shared card"
      cancelLabel="Keep current card"
      onCancel={() => setConfirm(null)}
      onConfirm={acceptIncoming}
    />}
  </AppLayout>
}
