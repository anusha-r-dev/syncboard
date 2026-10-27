import { createListenerMiddleware } from '@reduxjs/toolkit'
import type { AppDispatch, RootState } from '../../app/store'
import { boardActions, type BoardSnapshot } from '../board/boardSlice'
import { createInverseOperation } from '../history/inverseOperation'
import { historyActions } from '../history/historySlice'
import { presenceActions } from '../presence/presenceSlice'
import { nextLamport } from './conflictResolution'
import {
  enqueueOperation,
  queueSize,
  queuedOperations,
  removeQueuedOperation,
  saveSnapshot,
} from './persistence'
import { operationRequested, redoRequested, undoRequested } from './operationActions'
import { syncActions } from './syncSlice'
import type { Operation, OperationDraft, SyncTransport } from './types'

export const syncListener = createListenerMiddleware()
let activeTransport: SyncTransport | null = null

export function setActiveTransport(transport: SyncTransport): void {
  activeTransport = transport
}

function snapshotFromState(state: RootState): BoardSnapshot {
  return structuredClone({
    boards: state.board.boards,
    columns: state.board.columns,
    cards: state.board.cards,
    activeBoardId: state.board.activeBoardId,
  })
}

function baseVersionFor(draft: OperationDraft, state: RootState): number {
  if ('cardId' in draft.payload)
    return state.board.cards.entities[draft.payload.cardId]?.version ?? 0
  if ('columnId' in draft.payload) {
    return state.board.columns.entities[draft.payload.columnId]?.version ?? 0
  }
  return 0
}

function buildOperation(
  draft: OperationDraft,
  state: RootState,
  undoOf?: string,
): Operation {
  const lamport = nextLamport(
    state.sync.lamportCounter,
    undefined,
    state.presence.local.clientId,
  )
  return {
    ...draft,
    id: crypto.randomUUID(),
    clientId: state.presence.local.clientId,
    baseVersion: baseVersionFor(draft, state),
    timestamp: Date.now(),
    lamport,
    undoOf,
  }
}

syncListener.startListening({
  actionCreator: operationRequested,
  effect: async (action, api) => {
    const before = api.getState() as RootState
    const operation = buildOperation(action.payload.draft, before, action.payload.undoOf)
    const inverse = createInverseOperation(before.board, operation)

    api.dispatch(syncActions.lamportObserved(operation.lamport.counter))
    api.dispatch(boardActions.operationApplied({ operation, source: 'local' }))
    api.dispatch(syncActions.pendingAdded(operation))
    api.dispatch(syncActions.operationSeen(operation.id))

    if (action.payload.recordHistory !== false && inverse) {
      api.dispatch(
        historyActions.entryRecorded({
          id: operation.id,
          forward: action.payload.draft,
          inverse,
        }),
      )
    }

    const after = api.getState() as RootState
    await saveSnapshot(snapshotFromState(after))
    api.dispatch(syncActions.snapshotPersisted())

    if (!activeTransport || after.sync.devOptions.offline) {
      await enqueueOperation(operation)
      api.dispatch(syncActions.queuedCountChanged(await queueSize()))
      return
    }

    try {
      await activeTransport.send(operation)
      api.dispatch(syncActions.pendingRemoved(operation.id))
    } catch (error) {
      const latest = api.getState() as RootState
      if (latest.sync.devOptions.offline || activeTransport.status === 'offline') {
        await enqueueOperation(operation)
        api.dispatch(syncActions.queuedCountChanged(await queueSize()))
        api.dispatch(syncActions.statusChanged('offline'))
        return
      }

      if (inverse) {
        const rollback = buildOperation(inverse, latest, operation.id)
        api.dispatch(
          boardActions.operationApplied({ operation: rollback, source: 'rollback' }),
        )
      }
      api.dispatch(historyActions.entryDiscarded(operation.id))
      api.dispatch(syncActions.pendingRemoved(operation.id))
      api.dispatch(
        syncActions.toastAdded({
          tone: 'error',
          message:
            error instanceof Error ? error.message : 'The change could not be saved',
        }),
      )
      await saveSnapshot(snapshotFromState(api.getState() as RootState))
    }
  },
})

syncListener.startListening({
  actionCreator: undoRequested,
  effect: (_action, api) => {
    const state = api.getState() as RootState
    const entry = state.history.past.at(-1)
    if (!entry) return
    api.dispatch(
      operationRequested({
        draft: entry.inverse,
        recordHistory: false,
        undoOf: entry.id,
      }),
    )
    api.dispatch(historyActions.undone())
    api.dispatch(syncActions.toastAdded({ tone: 'info', message: 'Last change undone' }))
  },
})

syncListener.startListening({
  actionCreator: redoRequested,
  effect: (_action, api) => {
    const state = api.getState() as RootState
    const entry = state.history.future.at(-1)
    if (!entry) return
    api.dispatch(operationRequested({ draft: entry.forward, recordHistory: false }))
    api.dispatch(historyActions.redone())
    api.dispatch(syncActions.toastAdded({ tone: 'info', message: 'Change restored' }))
  },
})

syncListener.startListening({
  actionCreator: presenceActions.localPresencePatched,
  effect: (_action, api) => {
    activeTransport?.setPresence((api.getState() as RootState).presence.local)
  },
})

syncListener.startListening({
  actionCreator: syncActions.devOptionsChanged,
  effect: async (_action, api) => {
    const state = api.getState() as RootState
    activeTransport?.configure(state.sync.devOptions)
    api.dispatch(
      syncActions.statusChanged(state.sync.devOptions.offline ? 'offline' : 'online'),
    )
    if (!state.sync.devOptions.offline && activeTransport) {
      // Give the transport's catch-up response one event-loop turn to arrive while
      // local offline operations are still marked pending, so conflicts can be
      // explained before the queue is flushed.
      await new Promise((resolve) => window.setTimeout(resolve, 75))
      const queued = await queueSize()
      if (queued > 0) api.dispatch(syncActions.statusChanged('reconnecting'))
      for (const operation of await queuedOperations()) {
        try {
          await activeTransport.send(operation)
          await removeQueuedOperation(operation.id)
          api.dispatch(syncActions.pendingRemoved(operation.id))
        } catch {
          break
        }
      }
      api.dispatch(syncActions.queuedCountChanged(await queueSize()))
      api.dispatch(syncActions.statusChanged(activeTransport.status))
      activeTransport.setPresence((api.getState() as RootState).presence.local)
    }
  },
})

export type SyncListenerDispatch = AppDispatch
