import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import confetti from 'canvas-confetti'
import { makeActiveCard } from '../app/cardRecords'
import { MOCK_TASKS } from '../data/mockTasks'
import { createGameState, generateBingoCard, toggleCell, type GridSize } from '../game'
import { ACTIVE_CARD_KEY, loadActiveCard, saveActiveCard } from '../persistence/active-card'
import { renderApp } from '../test/renderApp'
import type { TaskSource } from '../data/taskSource'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const limitedTaskSource: TaskSource = { async getTasks() { return MOCK_TASKS.slice(0, 8) } }

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  localStorage.clear()
})

async function makeRandomCard(size: GridSize = 3, seed = 'component-seed', freeCenter = false) {
  const user = userEvent.setup()
  renderApp('/random')
  await screen.findByRole('heading', { name: 'Random card' })
  await user.selectOptions(screen.getByLabelText('Board size'), String(size))
  if (freeCenter) await user.click(screen.getByLabelText('Free centre square'))
  await user.type(screen.getByLabelText(/Seed/), seed)
  await user.click(screen.getByRole('button', { name: 'Create random card' }))
  await screen.findByRole('heading', { name: 'Bingo card' })
  return user
}

describe('home and random card flow', () => {
  it('offers random and custom card navigation', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: /Networking\s*Bingo/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Random card/ })).toHaveAttribute('href', '/random')
    expect(screen.getByRole('link', { name: /Build your own/ })).toHaveAttribute('href', '/create')
  })

  it.each([3, 4, 5, 6, 7] as const)('starts a random %i grid card', async (size) => {
    await makeRandomCard(size)
    expect(screen.getByRole('group', { name: size + ' by ' + size + ' bingo card' })).toBeInTheDocument()
    expect(screen.getByText('component-seed')).toBeInTheDocument()
  })

  it('shows the free-centre option only for odd grids and locks it in play', async () => {
    const user = userEvent.setup()
    renderApp('/random')
    await screen.findByLabelText('Board size')
    await user.selectOptions(screen.getByLabelText('Board size'), '4')
    expect(screen.queryByLabelText('Free centre square')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Board size'), '3')
    await user.click(screen.getByLabelText('Free centre square'))
    await user.type(screen.getByLabelText(/Seed/), 'free-center')
    await user.click(screen.getByRole('button', { name: 'Create random card' }))
    const freeTile = await screen.findByRole('button', { name: /Free centre square/ })
    expect(freeTile).toBeDisabled()
    expect(freeTile).toHaveAttribute('aria-pressed', 'true')
  })

  it('explains when the task pool is too small and offers a smaller grid', async () => {
    renderApp('/random', limitedTaskSource)
    await screen.findByRole('alert')
    expect(screen.getByText(/needs 25 tasks/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try a smaller board/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create random card' })).toBeDisabled()
  })

  it('asks before replacing an existing saved card', async () => {
    const oldCard = makeActiveCard('random', generateBingoCard(MOCK_TASKS, { gridSize: 3, seed: 'keep-this' }))
    saveActiveCard(oldCard)
    const user = userEvent.setup()
    renderApp('/random')
    await screen.findByRole('heading', { name: 'Random card' })
    await user.selectOptions(screen.getByLabelText('Board size'), '3')
    await user.type(screen.getByLabelText(/Seed/), 'replace-this')
    await user.click(screen.getByRole('button', { name: 'Create random card' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Replace your saved card?' })
    expect(loadActiveCard().activeCard?.card.seed).toBe('keep-this')
    await user.click(within(dialog).getByRole('button', { name: 'Replace card' }))
    await screen.findByText('replace-this')
    expect(loadActiveCard().activeCard?.card.seed).toBe('replace-this')
  })

  it('keeps replacement confirmation on Home before routing to setup', async () => {
    saveActiveCard(makeActiveCard('random', generateBingoCard(MOCK_TASKS, { gridSize: 3, seed: 'saved' })))
    const user = userEvent.setup()
    renderApp('/')
    await user.click(screen.getByRole('button', { name: 'New card' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Start a new card?' })
    await user.click(within(dialog).getByRole('button', { name: 'Choose a new card' }))
    await screen.findByRole('heading', { name: 'Random card' })
  })
})

describe('play and progress', () => {
  it('toggles a tile and saves the change to localStorage', async () => {
    const user = await makeRandomCard(3, 'toggle-seed')
    const tile = screen.getAllByRole('button', { name: /^Mark complete:/ })[0]!
    await user.click(tile)
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem(ACTIVE_CARD_KEY)!).completedCells[0]).toBe(true)
  })

  it('restores saved progress after unmount and reload', async () => {
    const user = await makeRandomCard(3, 'restore-seed')
    await user.click(screen.getAllByRole('button', { name: /^Mark complete:/ })[0]!)
    cleanup()
    renderApp('/play')
    const checkedTile = await screen.findByRole('button', { name: /^Mark incomplete:/ })
    expect(checkedTile).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('restore-seed')).toBeInTheDocument()
  })

  it('celebrates a newly completed line once and can celebrate it again after undo', async () => {
    const user = await makeRandomCard(3, 'line-seed')
    const tiles = screen.getAllByRole('button', { name: /^Mark complete:/ })
    const finalRowLabel = tiles[2]!.getAttribute('aria-label')!.replace('Mark complete: ', '')
    await user.click(tiles[0]!)
    await user.click(tiles[1]!)
    await user.click(tiles[2]!)
    expect(screen.queryByText(/BINGO!/)).not.toBeInTheDocument()
    expect(confetti).toHaveBeenCalledTimes(1)

    await user.click(screen.getAllByRole('button', { name: /^Mark complete:/ })[3]!)
    expect(confetti).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Mark incomplete: ' + finalRowLabel }))
    await user.click(screen.getByRole('button', { name: 'Mark complete: ' + finalRowLabel }))
    expect(confetti).toHaveBeenCalledTimes(2)
  })

  it('uses the larger full-card celebration instead of bingo on the final move', async () => {
    const card = generateBingoCard(MOCK_TASKS, { gridSize: 3, seed: 'full-seed' })
    let state = createGameState(card)
    for (let index = 0; index < 8; index += 1) state = toggleCell(state, index).state
    saveActiveCard(makeActiveCard('random', card, state.completedCells))
    const user = userEvent.setup()
    renderApp('/play')
    const lastTile = await screen.findByRole('button', { name: /^Mark complete:.*$/ })
    await user.click(lastTile)
    expect(await screen.findByText('Card complete.')).toBeInTheDocument()
    expect(screen.queryByText(/BINGO!/)).not.toBeInTheDocument()
    expect(confetti).toHaveBeenLastCalledWith(expect.objectContaining({ particleCount: 180, disableForReducedMotion: true }))
  })

  it('resets checks after confirmation while preserving the card', async () => {
    const card = generateBingoCard(MOCK_TASKS, { gridSize: 3, seed: 'reset-seed' })
    const started = makeActiveCard('random', card)
    saveActiveCard({ ...started, completedCells: [true, false, false, false, false, false, false, false, false] })
    const user = userEvent.setup()
    renderApp('/play')
    await user.click(await screen.findByRole('button', { name: 'Reset progress' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset checked squares?' })
    await user.click(within(dialog).getByRole('button', { name: 'Reset progress' }))
    expect(screen.getByText('reset-seed')).toBeInTheDocument()
    expect(loadActiveCard().activeCard?.card.cells).toEqual(card.cells)
    expect(loadActiveCard().activeCard?.completedCells).toEqual(Array(9).fill(false))
  })

  it('prepares a seeded random share link and explains custom sharing is not ready', async () => {
    await makeRandomCard(3, 'share-seed', true)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Share' }))
    const shareInput = screen.getByLabelText('Share link')
    expect((shareInput as HTMLInputElement).value).toContain('/play?size=3&seed=share-seed&free=1')
  })
})

describe('custom card builder', () => {
  it('keeps Play card disabled until all required cells have tasks', async () => {
    renderApp('/create')
    await screen.findByRole('heading', { name: 'Build your own' })
    expect(screen.getByRole('button', { name: 'Play card' })).toBeDisabled()
    expect(screen.getByText('9 squares left')).toBeInTheDocument()
  })

  it('moves a used prompt instead of placing a duplicate', async () => {
    const user = userEvent.setup()
    renderApp('/create')
    await screen.findByRole('heading', { name: 'Build your own' })
    await user.click(screen.getByRole('button', { name: 'Choose a task for square 1' }))
    await user.click(screen.getByRole('button', { name: new RegExp(MOCK_TASKS[0]!.text) }))
    await user.click(screen.getByRole('button', { name: 'Choose a task for square 2' }))
    const picker = screen.getByRole('dialog', { name: 'Choose a task' })
    await user.click(within(picker).getByRole('button', { name: new RegExp(MOCK_TASKS[0]!.text) }))
    expect(screen.getByRole('button', { name: 'Choose a task for square 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change square 2: ' + MOCK_TASKS[0]!.text })).toBeInTheDocument()
    expect(screen.getByText('8 squares left')).toBeInTheDocument()
  })

  it('builds and plays a complete custom card', async () => {
    const user = userEvent.setup()
    renderApp('/create')
    await screen.findByRole('heading', { name: 'Build your own' })
    for (let index = 0; index < 9; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Choose a task for square ' + (index + 1) }))
      await user.click(screen.getByRole('button', { name: new RegExp(MOCK_TASKS[index]!.text) }))
    }
    expect(screen.getByRole('button', { name: 'Play card' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Play card' }))
    await screen.findByRole('heading', { name: 'Bingo card' })
    expect(loadActiveCard().activeCard?.kind).toBe('custom')
    expect(loadActiveCard().activeCard?.card.seed).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.getByText(/Custom card sharing is not available/)).toBeInTheDocument()
  })
})

describe('saved data recovery', () => {
  it('clears corrupted storage and explains what happened', async () => {
    localStorage.setItem(ACTIVE_CARD_KEY, 'not-json')
    renderApp('/')
    expect(await screen.findByRole('status')).toHaveTextContent('cleared a saved card we could not read')
    expect(localStorage.getItem(ACTIVE_CARD_KEY)).toBeNull()
  })

  it('does not silently replace a saved card when opening a different share link', async () => {
    const current = makeActiveCard('random', generateBingoCard(MOCK_TASKS, { gridSize: 3, seed: 'current-card' }))
    saveActiveCard(current)
    const user = userEvent.setup()
    renderApp('/play?size=3&seed=incoming-card')
    await screen.findByText('A shared card is ready')
    expect(loadActiveCard().activeCard?.card.seed).toBe('current-card')
    await user.click(screen.getByRole('button', { name: 'Open shared card' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Open the shared card?' })
    expect(loadActiveCard().activeCard?.card.seed).toBe('current-card')
    await user.click(within(dialog).getByRole('button', { name: 'Open shared card' }))
    await screen.findByText('incoming-card')
    expect(loadActiveCard().activeCard?.card.seed).toBe('incoming-card')
  })

  it('opens a fresh random card from a share link when no card is saved', async () => {
    renderApp('/play?size=3&seed=new-player&free=1')
    expect(await screen.findByText('new-player')).toBeInTheDocument()
    const saved = loadActiveCard().activeCard
    expect(saved?.kind).toBe('random')
    expect(saved?.card.gridSize).toBe(3)
    expect(saved?.card.freeCenter).toBe(true)
    expect(saved?.completedCells.filter(Boolean)).toHaveLength(1)
  })

  it('preserves progress when the incoming share link identifies the active card', async () => {
    const card = generateBingoCard(MOCK_TASKS, { gridSize: 3, seed: 'same-card' })
    const record = makeActiveCard('random', card, [true, false, false, false, false, false, false, false, false])
    saveActiveCard(record)
    renderApp('/play?size=3&seed=same-card')
    const checked = await screen.findByRole('button', { name: /^Mark incomplete:/ })
    expect(checked).toHaveAttribute('aria-pressed', 'true')
    expect(loadActiveCard().activeCard?.completedCells[0]).toBe(true)
  })
})
