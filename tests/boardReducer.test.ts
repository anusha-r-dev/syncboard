import { describe, expect, it } from 'vitest'
import { boardActions, boardReducer } from '../src/features/board/boardSlice'
import type { Operation } from '../src/features/sync/types'

function updateOperation(counter: number, title: string): Operation {
  return {
    id: `operation-${counter}`,
    clientId: 'remote',
    type: 'card/update',
    payload: { cardId: 'card-1', patch: { title }, actorName: 'Alex' },
    baseVersion: 1,
    timestamp: 1_740_000_000_000 + counter,
    lamport: { counter, clientId: 'remote' },
  }
}

describe('board reducer', () => {
  it('applies an optimistic local card update', () => {
    const state = boardReducer(
      undefined,
      boardActions.operationApplied({
        operation: updateOperation(2, 'Updated title'),
        source: 'local',
      }),
    )
    expect(state.cards.entities['card-1']?.title).toBe('Updated title')
    expect(state.cards.entities['card-1']?.version).toBe(2)
  })

  it('ignores a stale remote field update', () => {
    const newer = boardReducer(
      undefined,
      boardActions.operationApplied({
        operation: updateOperation(8, 'Newest title'),
        source: 'remote',
      }),
    )
    const stale = boardReducer(
      newer,
      boardActions.operationApplied({
        operation: updateOperation(7, 'Stale title'),
        source: 'remote',
      }),
    )
    expect(stale.cards.entities['card-1']?.title).toBe('Newest title')
  })

  it('deletes a card and closes it if selected', () => {
    const selected = boardReducer(undefined, boardActions.cardSelected('card-1'))
    const operation: Operation = {
      id: 'delete-1',
      clientId: 'local',
      type: 'card/delete',
      payload: { cardId: 'card-1' },
      baseVersion: 1,
      timestamp: Date.now(),
      lamport: { counter: 2, clientId: 'local' },
    }
    const state = boardReducer(
      selected,
      boardActions.operationApplied({ operation, source: 'local' }),
    )
    expect(state.cards.entities['card-1']).toBeUndefined()
    expect(state.selectedCardId).toBeNull()
  })

  it('applies a bulk seed as one operation', () => {
    const initial = boardReducer(undefined, { type: 'test/init' })
    const template = initial.cards.entities['card-1']
    expect(template).toBeDefined()
    if (!template) return
    const cards = [1, 2].map((index) => ({
      ...structuredClone(template),
      id: `bulk-${index}`,
      title: `Bulk ${index}`,
    }))
    const operation: Operation = {
      id: 'bulk-create',
      clientId: 'local',
      type: 'card/createMany',
      payload: { cards },
      baseVersion: 0,
      timestamp: Date.now(),
      lamport: { counter: 2, clientId: 'local' },
    }
    const state = boardReducer(
      initial,
      boardActions.operationApplied({ operation, source: 'local' }),
    )
    expect(state.cards.entities['bulk-1']?.title).toBe('Bulk 1')
    expect(state.cards.entities['bulk-2']?.title).toBe('Bulk 2')
  })
})
