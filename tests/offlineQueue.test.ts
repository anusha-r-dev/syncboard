import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  enqueueOperation,
  queuedOperations,
  queueSize,
  removeQueuedOperation,
} from '../src/features/sync/persistence'
import type { Operation } from '../src/features/sync/types'

function operation(id: string, timestamp: number): Operation {
  return {
    id,
    clientId: 'local',
    type: 'card/delete',
    payload: { cardId: id },
    baseVersion: 1,
    timestamp,
    lamport: { counter: timestamp, clientId: 'local' },
  }
}

describe('offline operation queue', () => {
  beforeEach(async () => {
    await db.queuedOps.clear()
  })

  it('replays in insertion order and de-duplicates by operation id', async () => {
    await enqueueOperation(operation('one', 1))
    await enqueueOperation(operation('two', 2))
    await enqueueOperation(operation('one', 3))
    const queued = await queuedOperations()
    expect(queued.map((item) => item.id)).toEqual(['two', 'one'])
    expect(await queueSize()).toBe(2)
  })

  it('removes an acknowledged operation', async () => {
    await enqueueOperation(operation('one', 1))
    await removeQueuedOperation('one')
    expect(await queueSize()).toBe(0)
  })
})
