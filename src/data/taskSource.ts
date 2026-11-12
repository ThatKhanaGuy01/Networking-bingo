import type { BingoTask } from '../game'
import { getPublicTasks } from '../api/client'
import { MOCK_TASKS } from './mockTasks'

/** The UI depends on this source contract; Stage 4 can provide an API implementation. */
export interface TaskSource {
  getTasks(): Promise<readonly BingoTask[]>
}

export const mockTaskSource: TaskSource = {
  async getTasks() {
    return MOCK_TASKS
  },
}

export const apiTaskSource: TaskSource = {
  getTasks: getPublicTasks,
}
