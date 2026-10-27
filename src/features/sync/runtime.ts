import type { AppStore, RootState } from '../../app/store'
import { boardActions, type BoardSnapshot } from '../board/boardSlice'
import { presenceActions } from '../presence/presenceSlice'
import { BroadcastChannelTransport } from './BroadcastChannelTransport'
import { operationsConflict } from './conflictResolution'
import {
  loadSnapshot,
  queueSize,
  queuedOperations,
  removeQueuedOperation,
  saveSnapshot,
} from './persistence'
import { setActiveTransport } from './syncMiddleware'
import { syncActions } from './syncSlice'
import type { SyncTransport } from './types'

let cleanup: (() => void) | null = null

function snapshotFromState(state: RootState): BoardSnapshot {
  return structuredClone({
    boards: state.board.boards,
    columns: state.board.columns,
    cards: state.board.cards,
    activeBoardId: state.board.activeBoardId,
  })
}

async function createTransport(state: RootState): Promise<SyncTransport> {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    const { SupabaseTransport } = await import('./SupabaseTransport')
    return new SupabaseTransport(url, key, state.presence.local.clientId)
  }
  return new BroadcastChannelTransport()
}

export async function startSyncRuntime(store: AppStore): Promise<() => void> {
  cleanup?.()
  const snapshot = await loadSnapshot()
  if (snapshot) store.dispatch(boardActions.snapshotHydrated(snapshot))

  const transport = await createTransport(store.getState())
  setActiveTransport(transport)
  transport.configure(store.getState().sync.devOptions)
  await transport.connect()
  store.dispatch(syncActions.transportKindChanged(transport.kind))
  store.dispatch(syncActions.statusChanged(transport.status))

  const stopOps = transport.onOp((operation) => {
    const state = store.getState()
    if (
      operation.clientId === state.presence.local.clientId ||
      state.sync.seenOperationIds.includes(operation.id)
    ) {
      return
    }
    const actorName =
      operation.type === 'card/update'
        ? (operation.payload.actorName ?? 'a collaborator')
        : 'a collaborator'
    const conflictsWithPending = Object.values(state.sync.pending).some((pending) =>
      operationsConflict(pending, operation),
    )
    store.dispatch(syncActions.operationSeen(operation.id))
    store.dispatch(syncActions.lamportObserved(operation.lamport.counter))
    store.dispatch(boardActions.operationApplied({ operation, source: 'remote' }))
    store.dispatch(
      syncActions.toastAdded({
        tone: conflictsWithPending ? 'warning' : 'info',
        message: conflictsWithPending
          ? `Conflict resolved with ${actorName}'s newer change. Use Undo, then Redo, to restore your version.`
          : `Updated by ${actorName}`,
      }),
    )
    void saveSnapshot(snapshotFromState(store.getState()))
  })

  const stopPresence = transport.onPresence((presence) => {
    store.dispatch(presenceActions.remotePresenceReceived(presence))
  })

  let replayFailed = false
  for (const operation of await queuedOperations()) {
    try {
      await transport.send(operation)
      await removeQueuedOperation(operation.id)
      store.dispatch(syncActions.pendingRemoved(operation.id))
    } catch {
      replayFailed = true
      store.dispatch(syncActions.statusChanged('offline'))
      break
    }
  }
  store.dispatch(syncActions.queuedCountChanged(await queueSize()))
  if (!replayFailed) store.dispatch(syncActions.statusChanged(transport.status))
  transport.setPresence(store.getState().presence.local)

  cleanup = () => {
    stopOps()
    stopPresence()
    void transport.disconnect()
  }
  return cleanup
}
