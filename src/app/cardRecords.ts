import { createGameState, type BingoCard } from '../game'
import type { ActiveCardRecord, CardKind } from '../persistence/active-card'

export function makeActiveCard(kind: CardKind, card: BingoCard, completedCells = createGameState(card).completedCells): ActiveCardRecord {
  return { version: 1, kind, createdAt: Date.now(), card, completedCells }
}

export function sameCardIdentity(left: ActiveCardRecord, kind: CardKind, right: BingoCard): boolean {
  return left.kind === kind
    && left.card.seed === right.seed
    && left.card.gridSize === right.gridSize
    && left.card.freeCenter === right.freeCenter
    && left.card.cells.length === right.cells.length
    && left.card.cells.every((cell, index) => {
      const other = right.cells[index]
      return cell.isFree === other?.isFree
        && cell.task?.id === other?.task?.id
        && cell.task?.text === other?.task?.text
    })
}
