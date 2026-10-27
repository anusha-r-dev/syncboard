import { configureStore } from '@reduxjs/toolkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Operation, SyncTransport } from '../src/features/sync/types'

const persistence = vi.hoisted(() => ({
  enqueueOperation: vi.fn().mockResolvedValue(undefined),
  queueSize: vi.fn().mockResolvedValue(0),
  queuedOperations: vi.fn().mockResolvedValue([]),
  removeQueuedOperation: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/features/sync/persistence', () => persistence)

import { boardReducer } from '../src/features/board/boardSlice'
import { historyReducer } from '../src/features/history/historySlice'
import { presenceActions, presenceReducer } from '../src/features/presence/presenceSlice'
import {
  operationRequested,
  redoRequested,
  undoRequested,
} from '../src/features/sync/operationActions'
import { setActiveTransport, syncListener } from '../src/features/sync/syncMiddleware'
import { syncActions, syncReducer } from '../src/features/sync/syncSlice'

function makeTestStore() {
  return configureStore({
    reducer: {
      board: boardReducer,
      history: historyReducer,
      presence: presenceReducer,
      sync: syncReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListener.middleware),
  })
}

function fakeTransport() {
  return {
    kind: 'broadcast-channel',
    status: 'online',
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn<(operation: Operation) => Promise<void>>().mockResolvedValue(undefined),
    onOp: vi.fn(() => vi.fn()),
    onPresence: vi.fn(() => vi.fn()),
    setPresence: vi.fn<(state: Parameters<SyncTransport['setPresence']>[0]) => void>(),
    configure: vi.fn<(options: Parameters<SyncTransport['configure']>[0]) => void>(),
  } satisfies SyncTransport
}

describe('sync middleware lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    persistence.queueSize.mockResolvedValue(0)
    persistence.queuedOperations.mockResolvedValue([])
  })

  it('applies, sends, undoes, and redoes an edit while recording history', async () => {
    const store = makeTestStore()
    const transport = fakeTransport()
    setActiveTransport(transport)
    const cardId = String(store.getState().board.cards.ids[0])
    const originalTitle = store.getState().board.cards.entities[cardId]?.title

    store.dispatch(
      operationRequested({
        draft: { type: 'card/update', payload: { cardId, patch: { title: 'Updated' } } },
      }),
    )
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1))
    expect(store.getState().board.cards.entities[cardId]?.title).toBe('Updated')
    expect(store.getState().history.past).toHaveLength(1)
    expect(store.getState().sync.pending).toEqual({})
    expect(persistence.saveSnapshot).toHaveBeenCalled()

    store.dispatch(undoRequested())
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(2))
    expect(store.getState().board.cards.entities[cardId]?.title).toBe(originalTitle)
    expect(store.getState().history.future).toHaveLength(1)

    store.dispatch(redoRequested())
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(3))
    expect(store.getState().board.cards.entities[cardId]?.title).toBe('Updated')
    expect(store.getState().history.past).toHaveLength(1)
  })

  it('rolls back an edit and explains a non-offline transport rejection', async () => {
    const store = makeTestStore()
    const transport = fakeTransport()
    transport.send.mockRejectedValue(new Error('Server rejected the edit'))
    setActiveTransport(transport)
    const cardId = String(store.getState().board.cards.ids[0])
    const originalTitle = store.getState().board.cards.entities[cardId]?.title

    store.dispatch(
      operationRequested({
        draft: { type: 'card/update', payload: { cardId, patch: { title: 'Rejected' } } },
      }),
    )
    await vi.waitFor(() => expect(store.getState().sync.toasts).toHaveLength(1))

    expect(store.getState().board.cards.entities[cardId]?.title).toBe(originalTitle)
    expect(store.getState().history.past).toHaveLength(0)
    expect(store.getState().sync.toasts[0]?.message).toBe('Server rejected the edit')
  })

  it('queues offline work and flushes it after reconnecting', async () => {
    const store = makeTestStore()
    const transport = fakeTransport()
    setActiveTransport(transport)
    persistence.queueSize.mockResolvedValueOnce(1).mockResolvedValue(0)
    const cardId = String(store.getState().board.cards.ids[0])

    store.dispatch(syncActions.devOptionsChanged({ offline: true }))
    store.dispatch(
      operationRequested({
        draft: { type: 'card/delete', payload: { cardId } },
      }),
    )
    await vi.waitFor(() => expect(persistence.enqueueOperation).toHaveBeenCalled())
    const queued = persistence.enqueueOperation.mock.calls[0]?.[0] as Operation
    expect(store.getState().sync.status).toBe('offline')

    persistence.queuedOperations.mockResolvedValue([queued])
    store.dispatch(syncActions.devOptionsChanged({ offline: false }))
    await vi.waitFor(() => expect(persistence.removeQueuedOperation).toHaveBeenCalled())
    expect(transport.configure).toHaveBeenCalled()
    expect(transport.setPresence).toHaveBeenCalled()
    expect(store.getState().sync.queuedCount).toBe(0)
  })

  it('forwards local presence changes to the active transport', async () => {
    const store = makeTestStore()
    const transport = fakeTransport()
    setActiveTransport(transport)
    store.dispatch(presenceActions.localPresencePatched({ x: 42, y: 24 }))
    await vi.waitFor(() => expect(transport.setPresence).toHaveBeenCalled())
    expect(transport.setPresence.mock.calls[0]?.[0]).toMatchObject({ x: 42, y: 24 })
  })
})
