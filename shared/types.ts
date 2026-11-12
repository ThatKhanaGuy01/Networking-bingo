export type GridSize = 3 | 4 | 5 | 6 | 7

export interface BingoTask {
  id: string
  text: string
}

export interface CardSnapshot {
  id: string
  title: string
  gridSize: GridSize
  freeCenter: boolean
  cells: Array<{
    index: number
    row: number
    column: number
    task: BingoTask | null
    isFree: boolean
  }>
}

export interface SharedCardResponse extends CardSnapshot {
  completedCells: boolean[]
}
