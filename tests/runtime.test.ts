import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Operation, PresenceState } from '../src/features/sync/types'

const runtime = vi.hoisted(() => {
  let opListener: ((operation: Operation) => void) | undefined
  let presenceListener: ((presence: PresenceState) => void) | undefined
  const stopOps = vi.fn()
  const stopPresence = vi.fn()
  const transport = {
    kind: 'broadcast-channel' as const,
    status: 'online' as const,
    configure: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    setPresence: vi.fn(),
    onOp: vi.fn((callback: (operation: Operation) => void) => {
      opListener = callback
      return stopOps
    }),
    onPresence: vi.fn((callback: (presence: PresenceState) => void) => {
      presenceListener = callback
      return stopPresence
    }),
  }
  return {
    transport,
    stopOps,
    stopPresence,
    emitOp(operation: Operation) {
      opListener?.(operation)
    },
    emitPresence(presence: PresenceState) {
      presenceListener?.(presence)
    },
  }
})

const persistence = vi.hoisted(() => ({
  loadSnapshot: vi.fn().mockResolvedValue(null),
  queuedOperations: vi.fn().mockResolvedValue([]),
  removeQueuedOperation: vi.fn().mockResolvedValue(undefined),
  queueSize: vi.fn().mockResolvedValue(0),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/features/sync/BroadcastChannelTransport', () => ({
  BroadcastChannelTransport: class {
    constructor() {
      return runtime.transport
    }
  },
}))
vi.mock('../src/features/sync/persistence', () => persistence)

import { store } from '../src/app/store'
import { startSyncRuntime } from '../src/features/sync/runtime'

const remoteOperation: Operation = {
  id: 'remote-create',
  clientId: 'remote-client',
  type: 'card/delete',
  payload: { cardId: 'missing-card' },
  baseVersion: 0,
  timestamp: 10,
  lamport: { counter: 5, clientId: 'remote-client' },
}

describe('sync runtime lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    persistence.loadSnapshot.mockResolvedValue(null)
    persistence.queuedOperations.mockResolvedValue([])
    persistence.queueSize.mockResolvedValue(0)
    runtime.transport.send.mockResolvedValue(undefined)
  })

  it('connects, replays queued work, handles remote events, and cleans up', async () => {
    const queued = { ...remoteOperation, id: 'queued', clientId: 'local-client' }
    persistence.queuedOperations.mockResolvedValue([queued])
    persistence.queueSize.mockResolvedValue(1)

    const cleanup = await startSyncRuntime(store)
    expect(runtime.transport.configure).toHaveBeenCalled()
    expect(runtime.transport.connect).toHaveBeenCalledOnce()
    expect(runtime.transport.send).toHaveBeenCalledWith(queued)
    expect(persistence.removeQueuedOperation).toHaveBeenCalledWith('queued')
    expect(runtime.transport.setPresence).toHaveBeenCalled()

    runtime.emitOp(remoteOperation)
    await vi.waitFor(() => expect(persistence.saveSnapshot).toHaveBeenCalled())
    expect(store.getState().sync.seenOperationIds).toContain(remoteOperation.id)
    expect(store.getState().sync.lamportCounter).toBeGreaterThanOrEqual(5)

    const remotePresence: PresenceState = {
      ...store.getState().presence.local,
      clientId: 'another-viewer',
      name: 'Maya',
    }
    runtime.emitPresence(remotePresence)
    expect(store.getState().presence.remote['another-viewer']).toEqual(remotePresence)

    cleanup()
    expect(runtime.stopOps).toHaveBeenCalled()
    expect(runtime.stopPresence).toHaveBeenCalled()
    expect(runtime.transport.disconnect).toHaveBeenCalled()
  })

  it('marks the runtime offline when queued replay is rejected', async () => {
    persistence.queuedOperations.mockResolvedValue([remoteOperation])
    runtime.transport.send.mockRejectedValueOnce(new Error('network unavailable'))

    await startSyncRuntime(store)
    expect(store.getState().sync.status).toBe('offline')
    expect(persistence.removeQueuedOperation).not.toHaveBeenCalled()
  })
})
