import { describe, expect, it } from 'vitest'
import { boardReducer } from '../src/features/board/boardSlice'
import { createInverseOperation } from '../src/features/history/inverseOperation'
import type { Operation } from '../src/features/sync/types'

describe('inverse operations', () => {
  it('captures the previous field value for undo', () => {
    const state = boardReducer(undefined, { type: 'test/init' })
    const operation: Operation = {
      id: 'edit-1',
      clientId: 'local',
      type: 'card/update',
      payload: { cardId: 'card-1', patch: { title: 'Changed' } },
      baseVersion: 1,
      timestamp: Date.now(),
      lamport: { counter: 2, clientId: 'local' },
    }
    expect(createInverseOperation(state, operation)).toEqual({
      type: 'card/update',
      payload: { cardId: 'card-1', patch: { title: 'Interview pilot customers' } },
    })
  })

  it('turns create into delete and delete into create', () => {
    const state = boardReducer(undefined, { type: 'test/init' })
    const existing = state.cards.entities['card-1']
    expect(existing).toBeDefined()
    const deleteOperation: Operation = {
      id: 'delete-1',
      clientId: 'local',
      type: 'card/delete',
      payload: { cardId: 'card-1' },
      baseVersion: 1,
      timestamp: Date.now(),
      lamport: { counter: 2, clientId: 'local' },
    }
    expect(createInverseOperation(state, deleteOperation)).toEqual({
      type: 'card/create',
      payload: { card: existing },
    })
  })

  it('restores a deleted column together with its cards', () => {
    const state = boardReducer(undefined, { type: 'test/init' })
    const column = state.columns.entities.backlog
    expect(column).toBeDefined()
    const operation: Operation = {
      id: 'delete-column',
      clientId: 'local',
      type: 'column/delete',
      payload: { columnId: 'backlog' },
      baseVersion: 1,
      timestamp: Date.now(),
      lamport: { counter: 2, clientId: 'local' },
    }

    const inverse = createInverseOperation(state, operation)
    expect(inverse?.type).toBe('column/restore')
    if (inverse?.type !== 'column/restore') return
    expect(inverse.payload.column).toEqual(column)
    expect(inverse.payload.cards).toHaveLength(3)
  })
})
