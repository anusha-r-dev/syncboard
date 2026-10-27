import type { LamportTimestamp, Operation } from './types'

export function compareLamport(a: LamportTimestamp, b: LamportTimestamp): number {
  if (a.counter !== b.counter) return a.counter - b.counter
  return a.clientId.localeCompare(b.clientId)
}

export function shouldApplyRemoteField(
  current: LamportTimestamp | undefined,
  incoming: LamportTimestamp,
): boolean {
  return current === undefined || compareLamport(current, incoming) < 0
}

export function nextLamport(
  localCounter: number,
  remote: LamportTimestamp | undefined,
  clientId: string,
): LamportTimestamp {
  return {
    counter: Math.max(localCounter, remote?.counter ?? 0) + 1,
    clientId,
  }
}

export function operationsConflict(local: Operation, incoming: Operation): boolean {
  if (local.type !== 'card/update' || incoming.type !== 'card/update') return false
  if (local.payload.cardId !== incoming.payload.cardId) return false
  const localFields = new Set(Object.keys(local.payload.patch))
  return Object.keys(incoming.payload.patch).some((field) => localFields.has(field))
}
