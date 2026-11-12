import type { BingoCard, BingoCell, BingoTask, CardConfig, GridSize } from './types'
import { createRandomSeed, createSeededRandom } from './random'

const MIN_GRID_SIZE = 3
const MAX_GRID_SIZE = 7

function isGridSize(value: number): value is GridSize {
  return Number.isInteger(value) && value >= MIN_GRID_SIZE && value <= MAX_GRID_SIZE
}

function validateConfig(config: CardConfig): asserts config is CardConfig & { gridSize: GridSize } {
  if (!config || !isGridSize(config.gridSize)) {
    throw new RangeError('gridSize must be an integer from 3 to 7')
  }
  if (config.freeCenter !== undefined && typeof config.freeCenter !== 'boolean') {
    throw new TypeError('freeCenter must be a boolean when provided')
  }
  if (config.freeCenter && config.gridSize % 2 === 0) {
    throw new RangeError('freeCenter is only available for odd-sized grids')
  }
  if (config.seed !== undefined && typeof config.seed !== 'string') {
    throw new TypeError('seed must be a string when provided')
  }
}

function validateAndSortTasks(tasks: readonly BingoTask[]): BingoTask[] {
  if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array')

  const sorted = tasks.map((task) => {
    if (!task || typeof task.id !== 'string' || task.id.length === 0) {
      throw new TypeError('every task must have a non-empty string id')
    }
    if (typeof task.text !== 'string' || task.text.trim().length === 0) {
      throw new TypeError('task "' + task.id + '" must have non-empty text')
    }
    return { id: task.id, text: task.text }
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]?.id === sorted[index]?.id) {
      throw new TypeError('duplicate task id: "' + sorted[index]?.id + '"')
    }
  }
  return sorted
}

function shuffleTasks(tasks: BingoTask[], random: () => number): BingoTask[] {
  const shuffled = tasks.slice()
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
  }
  return shuffled
}

/**
 * Builds a row-major card after code-unit sorting IDs and seeded Fisher-Yates.
 * Identical config, task IDs/text, and seed always produce identical cells.
 */
export function generateBingoCard(tasks: readonly BingoTask[], config: CardConfig): BingoCard {
  validateConfig(config)
  const sortedTasks = validateAndSortTasks(tasks)
  const freeCenter = config.freeCenter ?? false
  const cellCount = config.gridSize * config.gridSize
  const taskCount = cellCount - (freeCenter ? 1 : 0)

  if (sortedTasks.length < taskCount) {
    throw new RangeError('Not enough tasks: need ' + taskCount + ', received ' + sortedTasks.length)
  }

  const seed = config.seed === undefined ? createRandomSeed() : config.seed
  const selectedTasks = shuffleTasks(sortedTasks, createSeededRandom(seed)).slice(0, taskCount)
  const centerIndex = Math.floor(cellCount / 2)
  let taskIndex = 0
  const cells: BingoCell[] = Array.from({ length: cellCount }, (_, index) => {
    const isFree = freeCenter && index === centerIndex
    return {
      index,
      row: Math.floor(index / config.gridSize),
      column: index % config.gridSize,
      task: isFree ? null : selectedTasks[taskIndex++]!,
      isFree,
    }
  })

  return { seed, gridSize: config.gridSize, freeCenter, cells }
}
