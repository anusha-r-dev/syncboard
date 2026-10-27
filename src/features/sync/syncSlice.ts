import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ConnectionStatus, Operation, TransportOptions } from './types'

export type Toast = {
  id: string
  tone: 'info' | 'success' | 'warning' | 'error'
  message: string
}

type SyncState = {
  status: ConnectionStatus
  pending: Record<string, Operation>
  queuedCount: number
  seenOperationIds: string[]
  lamportCounter: number
  persistedRevision: number
  transportKind: 'broadcast-channel' | 'supabase'
  devOptions: TransportOptions
  toasts: Toast[]
}

const initialState: SyncState = {
  status: 'reconnecting',
  pending: {},
  queuedCount: 0,
  seenOperationIds: [],
  lamportCounter: 0,
  persistedRevision: 0,
  transportKind: 'broadcast-channel',
  devOptions: { minLatency: 100, maxLatency: 300, offline: false, forceFailure: false },
  toasts: [],
}

export const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    statusChanged(state, action: PayloadAction<ConnectionStatus>) {
      state.status = action.payload
    },
    transportKindChanged(state, action: PayloadAction<SyncState['transportKind']>) {
      state.transportKind = action.payload
    },
    pendingAdded(state, action: PayloadAction<Operation>) {
      state.pending[action.payload.id] = action.payload
    },
    pendingRemoved(state, action: PayloadAction<string>) {
      delete state.pending[action.payload]
    },
    queuedCountChanged(state, action: PayloadAction<number>) {
      state.queuedCount = Math.max(0, action.payload)
    },
    operationSeen(state, action: PayloadAction<string>) {
      if (!state.seenOperationIds.includes(action.payload))
        state.seenOperationIds.push(action.payload)
      if (state.seenOperationIds.length > 1000) state.seenOperationIds.splice(0, 250)
    },
    lamportObserved(state, action: PayloadAction<number>) {
      state.lamportCounter = Math.max(state.lamportCounter, action.payload)
    },
    snapshotPersisted(state) {
      state.persistedRevision += 1
    },
    devOptionsChanged(state, action: PayloadAction<Partial<TransportOptions>>) {
      Object.assign(state.devOptions, action.payload)
      state.status = state.devOptions.offline ? 'offline' : 'reconnecting'
    },
    toastAdded(state, action: PayloadAction<Omit<Toast, 'id'>>) {
      state.toasts.push({ ...action.payload, id: crypto.randomUUID() })
      if (state.toasts.length > 4) state.toasts.shift()
    },
    toastRemoved(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload)
    },
  },
})

export const syncActions = syncSlice.actions
export const syncReducer = syncSlice.reducer
