import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { BingoTask } from '../game'
import { clearActiveCard, loadActiveCard, saveActiveCard, type ActiveCardRecord } from '../persistence/active-card'
import { mockTaskSource, type TaskSource } from '../data/taskSource'

type TaskStatus = 'loading' | 'ready' | 'error'
type StorageIssue = 'unavailable' | 'corrupted' | null

interface AppStateValue {
  readonly tasks: readonly BingoTask[]
  readonly taskStatus: TaskStatus
  readonly activeCard: ActiveCardRecord | null
  readonly storageIssue: StorageIssue
  readonly saveCard: (card: ActiveCardRecord) => boolean
  readonly removeCard: () => boolean
}

const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children, taskSource = mockTaskSource }: {
  children: ReactNode
  taskSource?: TaskSource
}) {
  const [tasks, setTasks] = useState<readonly BingoTask[]>([])
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('loading')
  const [loadedCard] = useState(() => loadActiveCard())
  const [activeCard, setActiveCard] = useState<ActiveCardRecord | null>(loadedCard.activeCard)
  const [storageIssue, setStorageIssue] = useState<StorageIssue>(loadedCard.issue)

  useEffect(() => {
    let current = true
    taskSource.getTasks().then((result) => {
      if (!current) return
      setTasks(result)
      setTaskStatus('ready')
    }).catch(() => {
      if (current) setTaskStatus('error')
    })
    return () => { current = false }
  }, [taskSource])

  const saveCard = (card: ActiveCardRecord) => {
    const saved = saveActiveCard(card)
    setActiveCard(card)
    setStorageIssue(saved ? null : 'unavailable')
    return saved
  }

  const removeCard = () => {
    const removed = clearActiveCard()
    setActiveCard(null)
    setStorageIssue(removed ? null : 'unavailable')
    return removed
  }

  return <AppStateContext.Provider value={{ tasks, taskStatus, activeCard, storageIssue, saveCard, removeCard }}>
    {children}
  </AppStateContext.Provider>
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}
