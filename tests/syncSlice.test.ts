import { describe, expect, it } from 'vitest'
import { syncActions, syncReducer } from '../src/features/sync/syncSlice'
import type { Operation } from '../src/features/sync/types'

const operation: Operation = {
  id: 'operation-1',
  clientId: 'local',
  type: 'card/delete',
  payload: { cardId: 'card-1' },
  baseVersion: 1,
  timestamp: 10,
  lamport: { counter: 4, clientId: 'local' },
}

describe('syncSlice', () => {
  it('tracks connection, transport, pending work, queue size, and Lamport time', () => {
    let state = syncReducer(undefined, syncActions.statusChanged('online'))
    state = syncReducer(state, syncActions.transportKindChanged('supabase'))
    state = syncReducer(state, syncActions.pendingAdded(operation))
    state = syncReducer(state, syncActions.queuedCountChanged(-4))
    state = syncReducer(state, syncActions.lamportObserved(8))
    state = syncReducer(state, syncActions.lamportObserved(3))
    state = syncReducer(state, syncActions.snapshotPersisted())

    expect(state.status).toBe('online')
    expect(state.transportKind).toBe('supabase')
    expect(state.pending[operation.id]).toEqual(operation)
    expect(state.queuedCount).toBe(0)
    expect(state.lamportCounter).toBe(8)
    expect(state.persistedRevision).toBe(1)

    state = syncReducer(state, syncActions.pendingRemoved(operation.id))
    expect(state.pending).toEqual({})
  })

  it('de-duplicates and bounds remembered operation ids', () => {
    let state = syncReducer(undefined, { type: 'init' })
    state = syncReducer(state, syncActions.operationSeen('same'))
    state = syncReducer(state, syncActions.operationSeen('same'))
    for (let index = 0; index < 1001; index += 1) {
      state = syncReducer(state, syncActions.operationSeen(`operation-${index}`))
    }
    expect(state.seenOperationIds).toHaveLength(752)
    expect(state.seenOperationIds.at(-1)).toBe('operation-1000')
  })

  it('updates demo options and keeps the toast queue compact', () => {
    let state = syncReducer(
      undefined,
      syncActions.devOptionsChanged({ offline: true, minLatency: 0 }),
    )
    expect(state.status).toBe('offline')
    expect(state.devOptions.minLatency).toBe(0)

    for (let index = 0; index < 5; index += 1) {
      state = syncReducer(
        state,
        syncActions.toastAdded({ tone: 'info', message: `Toast ${index}` }),
      )
    }
    expect(state.toasts).toHaveLength(4)
    expect(state.toasts[0]?.message).toBe('Toast 1')

    const id = state.toasts[0]?.id ?? ''
    state = syncReducer(state, syncActions.toastRemoved(id))
    expect(state.toasts).toHaveLength(3)
  })
})
