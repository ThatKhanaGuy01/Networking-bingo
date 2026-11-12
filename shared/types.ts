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
  tasks: BingoTask[]
}
