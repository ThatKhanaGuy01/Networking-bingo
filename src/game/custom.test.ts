import { describe, expect, it } from 'vitest'
import { assignTaskToCell, createCustomBingoCard, createEmptyPlacements, removeTaskFromCell } from './custom'
import type { BingoTask } from './types'

const task = (id: string): BingoTask => ({ id, text: 'Prompt ' + id })

describe('custom card placement', () => {
  it('creates a complete card with the shared bingo-card model', () => {
    let placements = createEmptyPlacements(3, true)
    for (let cell = 0; cell < 9; cell += 1) {
      if (cell !== 4) placements = assignTaskToCell(placements, cell, task('task-' + cell), 3, true)
    }
    const card = createCustomBingoCard(placements, 3, true)
    expect(card.seed).toBeNull()
    expect(card.cells).toHaveLength(9)
    expect(card.cells[4]).toMatchObject({ isFree: true, task: null })
    expect(card.cells.filter((cell) => cell.task)).toHaveLength(8)
  })

  it('moves a used task instead of duplicating it', () => {
    const first = assignTaskToCell(createEmptyPlacements(3), 0, task('same'), 3)
    const moved = assignTaskToCell(first, 5, task('same'), 3)
    expect(moved[0]).toBeNull()
    expect(moved[5]?.id).toBe('same')
    expect(moved.filter((placed) => placed?.id === 'same')).toHaveLength(1)
  })

  it('makes a replaced task available again', () => {
    const one = assignTaskToCell(createEmptyPlacements(3), 0, task('one'), 3)
    const two = assignTaskToCell(one, 0, task('two'), 3)
    expect(two[0]?.id).toBe('two')
    expect(two.filter(Boolean)).toHaveLength(1)
  })

  it('allows removing an assigned task', () => {
    const filled = assignTaskToCell(createEmptyPlacements(3), 2, task('remove-me'), 3)
    expect(removeTaskFromCell(filled, 2, 3)[2]).toBeNull()
  })

  it('rejects incomplete cards and duplicate task IDs', () => {
    const incomplete = assignTaskToCell(createEmptyPlacements(3, true), 0, task('only-one'), 3, true)
    expect(() => createCustomBingoCard(incomplete, 3, true)).toThrow('all non-free cells must have a task')
    const duplicate = Array.from({ length: 9 }, (_, index) => index === 4 ? null : task(index === 8 ? 'task-0' : 'task-' + index))
    expect(() => createCustomBingoCard(duplicate, 3, true)).toThrow('duplicate task id')
  })

  it('keeps the free centre locked in builder operations', () => {
    const empty = createEmptyPlacements(3, true)
    expect(() => assignTaskToCell(empty, 4, task('blocked'), 3, true)).toThrow('free centre cell')
    expect(() => removeTaskFromCell(empty, 4, 3, true)).toThrow('free centre cell')
  })
})
