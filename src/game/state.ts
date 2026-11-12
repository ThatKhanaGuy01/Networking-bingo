import type { BingoCard, BingoLine, GameState, GameTransition } from './types'

function validateState(state: GameState): void {
  if (!state || !state.card || !Array.isArray(state.completedCells)) {
    throw new TypeError('state must contain a card and completedCells array')
  }
  if (state.completedCells.length !== state.card.cells.length) {
    throw new RangeError('completedCells must contain one boolean for every card cell')
  }
  if (!state.completedCells.every((completed) => typeof completed === 'boolean')) {
    throw new TypeError('completedCells must contain only booleans')
  }
  for (const cell of state.card.cells) {
    if (cell.isFree && state.completedCells[cell.index] !== true) {
      throw new Error('the free centre cell must always be completed')
    }
  }
}

export function createGameState(card: BingoCard): GameState {
  const completedCells = card.cells.map((cell) => cell.isFree)
  return { card, completedCells }
}

export function getCompletedLines(state: GameState): BingoLine[] {
  validateState(state)
  const { gridSize } = state.card
  const completed = state.completedCells
  const lines: BingoLine[] = []
  const addIfComplete = (line: BingoLine) => {
    if (line.cells.every((index) => completed[index])) lines.push(line)
  }

  for (let row = 0; row < gridSize; row += 1) {
    addIfComplete({ type: 'row', index: row, cells: Array.from({ length: gridSize }, (_, column) => row * gridSize + column) })
  }
  for (let column = 0; column < gridSize; column += 1) {
    addIfComplete({ type: 'column', index: column, cells: Array.from({ length: gridSize }, (_, row) => row * gridSize + column) })
  }

  addIfComplete({ type: 'diagonal', direction: 'main', cells: Array.from({ length: gridSize }, (_, index) => index * gridSize + index) })
  addIfComplete({ type: 'diagonal', direction: 'anti', cells: Array.from({ length: gridSize }, (_, index) => index * gridSize + gridSize - index - 1) })
  return lines
}

export function isCardComplete(state: GameState): boolean {
  validateState(state)
  return state.completedCells.every(Boolean)
}

function lineKey(line: BingoLine): string {
  return line.type === 'diagonal' ? line.type + ':' + line.direction : line.type + ':' + line.index
}

/** Toggles a tile and reports wins that became true in this transition only. */
export function toggleCell(state: GameState, cellIndex: number): GameTransition {
  validateState(state)
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.card.cells.length) {
    throw new RangeError('cellIndex must be an integer from 0 to ' + (state.card.cells.length - 1))
  }

  if (state.card.cells[cellIndex]?.isFree) {
    const completedLines = getCompletedLines(state)
    return { state, completedLines, newlyCompletedLines: [], newlyCompletedFullCard: false, celebration: null }
  }

  const completedCells = state.completedCells.slice()
  completedCells[cellIndex] = !completedCells[cellIndex]
  const nextState: GameState = { card: state.card, completedCells }
  const completedLines = getCompletedLines(nextState)
  const previousKeys = new Set(getCompletedLines(state).map(lineKey))
  const newlyCompletedLines = completedLines.filter((line) => !previousKeys.has(lineKey(line)))
  const newlyCompletedFullCard = isCardComplete(nextState) && !isCardComplete(state)
  const celebration: GameTransition['celebration'] = newlyCompletedFullCard
    ? { type: 'full-card' }
    : newlyCompletedLines.length > 0
      ? { type: 'bingo', lines: newlyCompletedLines }
      : null

  return { state: nextState, completedLines, newlyCompletedLines, newlyCompletedFullCard, celebration }
}
