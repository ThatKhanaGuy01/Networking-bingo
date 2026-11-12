import { describe, expect, it } from 'vitest'
import {
  createGameState,
  generateBingoCard,
  getCompletedLines,
  hashSeed,
  isCardComplete,
  toggleCell,
  type BingoCard,
  type BingoTask,
  type GameState,
  type GridSize,
} from './index'

function tasks(count: number): BingoTask[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 'task-' + String(index).padStart(2, '0'),
    text: 'Task ' + index,
  }))
}

function card(gridSize: GridSize = 3, freeCenter = false): BingoCard {
  return generateBingoCard(tasks(gridSize * gridSize), { gridSize, freeCenter, seed: 'test-seed' })
}

function completeCells(state: GameState, indexes: readonly number[]): GameState {
  return indexes.reduce((current, index) => toggleCell(current, index).state, state)
}

describe('generateBingoCard', () => {
  it.each([3, 4, 5, 6, 7] as const)('creates a %ix%i row-major grid', (gridSize) => {
    const result = generateBingoCard(tasks(gridSize * gridSize), { gridSize, seed: 'grid-test' })
    expect(result.cells).toHaveLength(gridSize * gridSize)
    expect(result.cells.every((cell, index) => cell.index === index)).toBe(true)
    expect(result.cells[gridSize + 1]).toMatchObject({ row: 1, column: 1 })
  })

  it.each([2, 8, 3.5, 0, -1] as number[])('rejects invalid grid size %s', (gridSize) => {
    expect(() => generateBingoCard(tasks(50), { gridSize: gridSize as GridSize, seed: 'x' })).toThrow(/gridSize must be an integer from 3 to 7/)
  })

  it.each([3, 5, 7] as const)('places an optional free centre in an odd %i grid', (gridSize) => {
    const result = generateBingoCard(tasks(gridSize * gridSize - 1), { gridSize, freeCenter: true, seed: 'free' })
    const center = result.cells[Math.floor(result.cells.length / 2)]
    expect(center).toMatchObject({ isFree: true, task: null })
    expect(result.cells.filter((cell) => cell.task)).toHaveLength(gridSize * gridSize - 1)
  })

  it.each([4, 6] as const)('rejects a free centre in an even %i grid', (gridSize) => {
    expect(() => generateBingoCard(tasks(gridSize * gridSize), { gridSize, freeCenter: true, seed: 'free' })).toThrow(/only available for odd-sized grids/)
  })

  it('fills every cell in an even grid when no free centre is requested', () => {
    const result = generateBingoCard(tasks(16), { gridSize: 4, seed: 'even' })
    expect(result.cells.every((cell) => !cell.isFree && cell.task !== null)).toBe(true)
  })

  it('uses a free centre when checking the required task count', () => {
    expect(() => generateBingoCard(tasks(8), { gridSize: 3, seed: 'short' })).toThrow('Not enough tasks: need 9, received 8')
    expect(generateBingoCard(tasks(8), { gridSize: 3, freeCenter: true, seed: 'enough' }).cells).toHaveLength(9)
  })

  it('rejects duplicate immutable task IDs', () => {
    const pool = [...tasks(8), { id: 'task-00', text: 'Conflicting duplicate' }]
    expect(() => generateBingoCard(pool, { gridSize: 3, freeCenter: true, seed: 'dupe' })).toThrow('duplicate task id')
  })

  it('never repeats a task in a card', () => {
    const result = generateBingoCard(tasks(55), { gridSize: 7, seed: 'unique' })
    const ids = result.cells.flatMap((cell) => cell.task ? [cell.task.id] : [])
    expect(new Set(ids).size).toBe(49)
  })

  it('reproduces the same card for the same seed and inputs', () => {
    const pool = tasks(30)
    expect(generateBingoCard(pool, { gridSize: 5, seed: 'repeatable' }))
      .toEqual(generateBingoCard(pool, { gridSize: 5, seed: 'repeatable' }))
  })

  it('usually changes the card when the seed changes', () => {
    const pool = tasks(25)
    const first = generateBingoCard(pool, { gridSize: 5, seed: 'seed-a' })
    const second = generateBingoCard(pool, { gridSize: 5, seed: 'seed-b' })
    expect(second.cells.map((cell) => cell.task?.id)).not.toEqual(first.cells.map((cell) => cell.task?.id))
  })

  it('treats seeds as case-sensitive and does not normalize them', () => {
    expect(hashSeed('Bingo')).not.toBe(hashSeed('bingo'))
    expect(hashSeed(' bingo')).not.toBe(hashSeed('bingo'))
  })

  it('sorts tasks by ID before shuffling regardless of input order', () => {
    const pool = tasks(20)
    const forward = generateBingoCard(pool, { gridSize: 4, seed: 'order' })
    const reversed = generateBingoCard(pool.slice().reverse(), { gridSize: 4, seed: 'order' })
    expect(reversed).toEqual(forward)
  })

  it('returns an omitted seed so a generated card can be reproduced', () => {
    const pool = tasks(9)
    const generated = generateBingoCard(pool, { gridSize: 3 })
    expect(generated.seed).toMatch(/^[0-9a-f]{32}$/)
    expect(generateBingoCard(pool, { gridSize: 3, seed: generated.seed! })).toEqual(generated)
  })

  it('preserves the known-answer card for the documented seed algorithm', () => {
    const result = generateBingoCard(tasks(12), { gridSize: 3, seed: 'known-answer-v1' })
    expect(hashSeed('known-answer-v1')).toBe(2712188017)
    expect(result.cells.map((cell) => cell.task?.id)).toEqual([
      'task-03', 'task-08', 'task-01',
      'task-11', 'task-04', 'task-10',
      'task-05', 'task-09', 'task-02',
    ])
  })
})

describe('game state and win detection', () => {
  it('detects a completed horizontal row', () => {
    const state = completeCells(createGameState(card()), [0, 1, 2])
    expect(getCompletedLines(state)).toContainEqual({ type: 'row', index: 0, cells: [0, 1, 2] })
  })

  it('detects a completed vertical column', () => {
    const state = completeCells(createGameState(card()), [1, 4, 7])
    expect(getCompletedLines(state)).toContainEqual({ type: 'column', index: 1, cells: [1, 4, 7] })
  })

  it('detects both main diagonals', () => {
    const main = completeCells(createGameState(card()), [0, 4, 8])
    const anti = completeCells(createGameState(card()), [2, 4, 6])
    expect(getCompletedLines(main)).toContainEqual({ type: 'diagonal', direction: 'main', cells: [0, 4, 8] })
    expect(getCompletedLines(anti)).toContainEqual({ type: 'diagonal', direction: 'anti', cells: [2, 4, 6] })
  })

  it('returns multiple lines completed by the same move', () => {
    const before = completeCells(createGameState(card()), [1, 2, 3, 6])
    const transition = toggleCell(before, 0)
    expect(transition.newlyCompletedLines.map((line) => line.type + ':' + ('index' in line ? line.index : line.direction)).sort())
      .toEqual(['column:0', 'row:0'])
    expect(transition.celebration?.type).toBe('bingo')
  })

  it('toggles a completed tile back to incomplete without mutating prior state', () => {
    const original = createGameState(card())
    const marked = toggleCell(original, 0).state
    const undone = toggleCell(marked, 0).state
    expect(original.completedCells[0]).toBe(false)
    expect(marked.completedCells[0]).toBe(true)
    expect(undone.completedCells[0]).toBe(false)
  })

  it('keeps a free centre complete and makes it untoggleable', () => {
    const initial = createGameState(card(3, true))
    const transition = toggleCell(initial, 4)
    expect(initial.completedCells[4]).toBe(true)
    expect(transition.state).toBe(initial)
    expect(transition.state.completedCells[4]).toBe(true)
    expect(transition.celebration).toBeNull()
  })

  it('detects full-card completion as a separate event', () => {
    const before = completeCells(createGameState(card()), Array.from({ length: 8 }, (_, index) => index))
    const transition = toggleCell(before, 8)
    expect(isCardComplete(transition.state)).toBe(true)
    expect(transition.newlyCompletedFullCard).toBe(true)
    expect(transition.celebration).toEqual({ type: 'full-card' })
  })

  it('prioritizes full-card celebration when the final tile completes lines too', () => {
    const before = completeCells(createGameState(card()), Array.from({ length: 8 }, (_, index) => index))
    const transition = toggleCell(before, 8)
    expect(transition.newlyCompletedLines.length).toBeGreaterThan(0)
    expect(transition.newlyCompletedFullCard).toBe(true)
    expect(transition.celebration).toEqual({ type: 'full-card' })
  })

  it('does not repeat line celebrations while those lines remain complete', () => {
    const stateWithBingo = completeCells(createGameState(card()), [0, 1, 2])
    const transition = toggleCell(stateWithBingo, 4)
    expect(transition.completedLines).toContainEqual({ type: 'row', index: 0, cells: [0, 1, 2] })
    expect(transition.newlyCompletedLines).toEqual([])
    expect(transition.celebration).toBeNull()
  })

  it('allows a line celebration again after undoing and re-completing the line', () => {
    const initial = createGameState(card())
    const twoMarked = completeCells(initial, [0, 1])
    const firstBingo = toggleCell(twoMarked, 2)
    const undone = toggleCell(firstBingo.state, 2)
    const repeatedBingo = toggleCell(undone.state, 2)
    expect(firstBingo.celebration?.type).toBe('bingo')
    expect(undone.celebration).toBeNull()
    expect(repeatedBingo.celebration?.type).toBe('bingo')
  })

  it('rejects invalid cell indexes', () => {
    const state = createGameState(card())
    expect(() => toggleCell(state, -1)).toThrow(RangeError)
    expect(() => toggleCell(state, state.card.cells.length)).toThrow(RangeError)
  })
})
