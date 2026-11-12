import type { BingoCard, BingoCell, GridSize } from '../game'

export const ACTIVE_CARD_KEY = 'networking-bingo.active-card'
export const ACTIVE_CARD_VERSION = 1

export type CardKind = 'random' | 'custom'

export interface ActiveCardRecord {
  readonly version: 1
  readonly kind: CardKind
  readonly createdAt: number
  readonly card: BingoCard
  readonly completedCells: readonly boolean[]
}

export interface LoadActiveCardResult {
  readonly activeCard: ActiveCardRecord | null
  readonly issue: 'unavailable' | 'corrupted' | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGridSize(value: unknown): value is GridSize {
  return value === 3 || value === 4 || value === 5 || value === 6 || value === 7
}

function isCell(value: unknown, index: number, gridSize: GridSize, freeCenter: boolean, ids: Set<string>): value is BingoCell {
  if (!isRecord(value)) return false
  const row = Math.floor(index / gridSize)
  const column = index % gridSize
  const expectedFree = freeCenter && index === Math.floor(gridSize * gridSize / 2)
  if (value.index !== index || value.row !== row || value.column !== column || value.isFree !== expectedFree) return false

  if (expectedFree) return value.task === null
  if (!isRecord(value.task) || typeof value.task.id !== 'string' || !value.task.id || typeof value.task.text !== 'string' || !value.task.text.trim()) return false
  if (ids.has(value.task.id)) return false
  ids.add(value.task.id)
  return true
}

function isActiveCardRecord(value: unknown): value is ActiveCardRecord {
  if (!isRecord(value) || value.version !== ACTIVE_CARD_VERSION) return false
  if (value.kind !== 'random' && value.kind !== 'custom') return false
  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return false
  const card = value.card
  if (!isRecord(card) || !isGridSize(card.gridSize) || typeof card.freeCenter !== 'boolean') return false
  if (card.freeCenter && card.gridSize % 2 === 0) return false
  if (value.kind === 'random' ? typeof card.seed !== 'string' : card.seed !== null) return false
  if (!Array.isArray(card.cells) || card.cells.length !== card.gridSize * card.gridSize) return false
  const ids = new Set<string>()
  if (!card.cells.every((cell, index) => isCell(cell, index, card.gridSize as GridSize, card.freeCenter as boolean, ids))) return false
  if (!Array.isArray(value.completedCells) || value.completedCells.length !== card.cells.length) return false
  if (!value.completedCells.every((completed) => typeof completed === 'boolean')) return false
  const centerIndex = Math.floor(card.gridSize * card.gridSize / 2)
  if (card.freeCenter && value.completedCells[centerIndex] !== true) return false
  return true
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadActiveCard(): LoadActiveCardResult {
  const store = storage()
  if (!store) return { activeCard: null, issue: 'unavailable' }

  let raw: string | null
  try {
    raw = store.getItem(ACTIVE_CARD_KEY)
  } catch {
    return { activeCard: null, issue: 'unavailable' }
  }
  if (raw === null) return { activeCard: null, issue: null }

  try {
    const value: unknown = JSON.parse(raw)
    if (isActiveCardRecord(value)) return { activeCard: value, issue: null }
  } catch { /* Invalid JSON is treated like an outdated save. */ }
  try { store.removeItem(ACTIVE_CARD_KEY) } catch { /* Storage may be read-only. */ }
  return { activeCard: null, issue: 'corrupted' }
}

export function saveActiveCard(activeCard: ActiveCardRecord): boolean {
  const store = storage()
  if (!store || !isActiveCardRecord(activeCard)) return false
  try {
    store.setItem(ACTIVE_CARD_KEY, JSON.stringify(activeCard))
    return true
  } catch {
    return false
  }
}

export function clearActiveCard(): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.removeItem(ACTIVE_CARD_KEY)
    return true
  } catch {
    return false
  }
}
