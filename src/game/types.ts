export type GridSize = 3 | 4 | 5 | 6 | 7

export interface BingoTask {
  readonly id: string
  readonly text: string
}

export interface CardConfig {
  readonly gridSize: GridSize
  readonly freeCenter?: boolean
  /** Case-sensitive UTF-8 seed. Omitted seeds are generated with Web Crypto. */
  readonly seed?: string
}

export interface BingoCell {
  readonly index: number
  readonly row: number
  readonly column: number
  readonly task: BingoTask | null
  readonly isFree: boolean
}

export interface BingoCard {
  readonly seed: string | null
  readonly gridSize: GridSize
  readonly freeCenter: boolean
  readonly cells: readonly BingoCell[]
}

export type BingoLine =
  | { readonly type: 'row'; readonly index: number; readonly cells: readonly number[] }
  | { readonly type: 'column'; readonly index: number; readonly cells: readonly number[] }
  | { readonly type: 'diagonal'; readonly direction: 'main' | 'anti'; readonly cells: readonly number[] }

export interface GameState {
  readonly card: BingoCard
  /** Boolean per row-major card cell; the free centre is always true. */
  readonly completedCells: readonly boolean[]
}

export type Celebration =
  | { readonly type: 'full-card' }
  | { readonly type: 'bingo'; readonly lines: readonly BingoLine[] }
  | null

export interface GameTransition {
  readonly state: GameState
  readonly completedLines: readonly BingoLine[]
  readonly newlyCompletedLines: readonly BingoLine[]
  readonly newlyCompletedFullCard: boolean
  /** A full-card win takes precedence when a move also completes bingo lines. */
  readonly celebration: Celebration
}
