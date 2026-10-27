import Dexie, { type EntityTable } from 'dexie'
import type { BoardSnapshot } from '../board/boardSlice'
import type { Operation } from './types'

type QueuedOperation = {
  id: string
  operation: Operation
  queuedAt: number
}

type SnapshotRecord = {
  id: 'active'
  snapshot: BoardSnapshot
  savedAt: number
}

class SyncBoardDatabase extends Dexie {
  queuedOps!: EntityTable<QueuedOperation, 'id'>
  snapshots!: EntityTable<SnapshotRecord, 'id'>

  constructor() {
    super('syncboard')
    this.version(1).stores({
      queuedOps: 'id, queuedAt',
      snapshots: 'id, savedAt',
    })
  }
}

export const db = new SyncBoardDatabase()

export async function saveSnapshot(snapshot: BoardSnapshot): Promise<void> {
  await db.snapshots.put({ id: 'active', snapshot, savedAt: Date.now() })
}

export async function loadSnapshot(): Promise<BoardSnapshot | null> {
  const record = await db.snapshots.get('active')
  if (!record) return null
  const snapshot = structuredClone(record.snapshot)
  const performanceIds = snapshot.cards.ids.filter((id) => {
    const card = snapshot.cards.entities[id]
    return id.startsWith('performance-') || card?.title.startsWith('Performance sample ')
  })
  if (performanceIds.length === 0) return snapshot
  snapshot.cards.ids = snapshot.cards.ids.filter((id) => !performanceIds.includes(id))
  for (const id of performanceIds) delete snapshot.cards.entities[id]
  await saveSnapshot(snapshot)
  return snapshot
}

export async function enqueueOperation(operation: Operation): Promise<void> {
  await db.transaction('rw', db.queuedOps, async () => {
    const newest = await db.queuedOps.orderBy('queuedAt').last()
    const queuedAt = Math.max(Date.now(), (newest?.queuedAt ?? 0) + 1)
    await db.queuedOps.put({ id: operation.id, operation, queuedAt })
  })
}

export async function queuedOperations(): Promise<Operation[]> {
  const rows = await db.queuedOps.orderBy('queuedAt').toArray()
  return rows.map((row) => row.operation)
}

export async function removeQueuedOperation(id: string): Promise<void> {
  await db.queuedOps.delete(id)
}

export async function queueSize(): Promise<number> {
  return db.queuedOps.count()
}
