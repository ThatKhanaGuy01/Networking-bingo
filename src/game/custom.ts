import type { BingoCard, BingoCell, BingoTask, GridSize } from './types'

export type CustomPlacements = readonly (BingoTask | null)[]

function validateOptions(gridSize: number, freeCenter: boolean): asserts gridSize is GridSize {
  if (!Number.isInteger(gridSize) || gridSize < 3 || gridSize > 7) {
    throw new RangeError('gridSize must be an integer from 3 to 7')
  }
  if (typeof freeCenter !== 'boolean') throw new TypeError('freeCenter must be a boolean')
  if (freeCenter && gridSize % 2 === 0) {
    throw new RangeError('freeCenter is only available for odd-sized grids')
  }
}

function centerIndex(gridSize: number): number {
  return Math.floor(gridSize * gridSize / 2)
}

function validatePlacementIndex(index: number, gridSize: number, freeCenter: boolean): void {
  const count = gridSize * gridSize
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError('cellIndex must be an integer from 0 to ' + (count - 1))
  }
  if (freeCenter && index === centerIndex(gridSize)) {
    throw new Error('the free centre cell cannot hold a task')
  }
}

export function createEmptyPlacements(gridSize: GridSize, freeCenter = false): (BingoTask | null)[] {
  validateOptions(gridSize, freeCenter)
  return Array.from({ length: gridSize * gridSize }, () => null)
}

/** Places a task at a target cell, moving any existing copy from its old cell. */
export function assignTaskToCell(
  placements: CustomPlacements,
  cellIndex: number,
  task: BingoTask,
  gridSize: GridSize,
  freeCenter = false,
): (BingoTask | null)[] {
  validateOptions(gridSize, freeCenter)
  if (placements.length !== gridSize * gridSize) throw new RangeError('placements length must match the grid size')
  validatePlacementIndex(cellIndex, gridSize, freeCenter)
  if (!task || !task.id || !task.text.trim()) throw new TypeError('task must have a non-empty id and text')

  const next = placements.slice()
  const previousIndex = next.findIndex((placed) => placed?.id === task.id)
  if (previousIndex >= 0) next[previousIndex] = null
  next[cellIndex] = { id: task.id, text: task.text }
  return next
}

export function removeTaskFromCell(
  placements: CustomPlacements,
  cellIndex: number,
  gridSize: GridSize,
  freeCenter = false,
): (BingoTask | null)[] {
  validateOptions(gridSize, freeCenter)
  if (placements.length !== gridSize * gridSize) throw new RangeError('placements length must match the grid size')
  validatePlacementIndex(cellIndex, gridSize, freeCenter)
  const next = placements.slice()
  next[cellIndex] = null
  return next
}

/** Converts a complete custom placement into the same serializable card model as a random card. */
export function createCustomBingoCard(
  placements: CustomPlacements,
  gridSize: GridSize,
  freeCenter = false,
): BingoCard {
  validateOptions(gridSize, freeCenter)
  const count = gridSize * gridSize
  if (placements.length !== count) throw new RangeError('placements length must match the grid size')

  const center = centerIndex(gridSize)
  const seen = new Set<string>()
  const cells: BingoCell[] = placements.map((task, index) => {
    const isFree = freeCenter && index === center
    if (isFree) {
      if (task !== null) throw new Error('the free centre cell must not contain a task')
      return { index, row: Math.floor(index / gridSize), column: index % gridSize, task: null, isFree: true }
    }
    if (task === null) throw new Error('all non-free cells must have a task')
    if (!task.id || !task.text.trim()) throw new TypeError('every task must have a non-empty id and text')
    if (seen.has(task.id)) throw new Error('duplicate task id: "' + task.id + '"')
    seen.add(task.id)
    return {
      index,
      row: Math.floor(index / gridSize),
      column: index % gridSize,
      task: { id: task.id, text: task.text },
      isFree: false,
    }
  })

  return { seed: null, gridSize, freeCenter, cells }
}
