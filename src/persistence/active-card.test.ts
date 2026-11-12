import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeActiveCard } from '../app/cardRecords'
import { generateBingoCard } from '../game'
import { ACTIVE_CARD_KEY, clearActiveCard, loadActiveCard, saveActiveCard } from './active-card'

function activeCard() {
  const tasks = Array.from({ length: 9 }, (_, index) => ({ id: 'task-' + index, text: 'Prompt ' + index }))
  return makeActiveCard('random', generateBingoCard(tasks, { gridSize: 3, seed: 'saved-seed' }))
}

describe('active card persistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('saves and restores one complete, versioned card record', () => {
    const card = activeCard()
    expect(saveActiveCard(card)).toBe(true)
    expect(localStorage.length).toBe(1)
    expect(JSON.parse(localStorage.getItem(ACTIVE_CARD_KEY)!).version).toBe(1)
    expect(loadActiveCard()).toEqual({ activeCard: card, issue: null })
  })

  it('clears malformed or outdated saved data safely', () => {
    localStorage.setItem(ACTIVE_CARD_KEY, '{broken')
    expect(loadActiveCard()).toEqual({ activeCard: null, issue: 'corrupted' })
    expect(localStorage.getItem(ACTIVE_CARD_KEY)).toBeNull()

    localStorage.setItem(ACTIVE_CARD_KEY, JSON.stringify({ version: 99 }))
    expect(loadActiveCard()).toEqual({ activeCard: null, issue: 'corrupted' })
    expect(localStorage.getItem(ACTIVE_CARD_KEY)).toBeNull()
  })

  it('reports unavailable storage without throwing', () => {
    vi.stubGlobal('localStorage', null)
    expect(loadActiveCard()).toEqual({ activeCard: null, issue: 'unavailable' })
    expect(saveActiveCard(activeCard())).toBe(false)
    expect(clearActiveCard()).toBe(false)
  })

  it('removes exactly the active card on request', () => {
    saveActiveCard(activeCard())
    expect(clearActiveCard()).toBe(true)
    expect(loadActiveCard()).toEqual({ activeCard: null, issue: null })
  })
})
