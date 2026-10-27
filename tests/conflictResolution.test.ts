import { describe, expect, it } from 'vitest'
import {
  compareLamport,
  nextLamport,
  operationsConflict,
  shouldApplyRemoteField,
} from '../src/features/sync/conflictResolution'
import type { Operation } from '../src/features/sync/types'

describe('Lamport last-writer-wins conflict resolution', () => {
  it('prefers the higher logical clock', () => {
    expect(
      shouldApplyRemoteField(
        { counter: 4, clientId: 'alpha' },
        { counter: 5, clientId: 'beta' },
      ),
    ).toBe(true)
    expect(
      shouldApplyRemoteField(
        { counter: 6, clientId: 'alpha' },
        { counter: 5, clientId: 'beta' },
      ),
    ).toBe(false)
  })

  it('uses client id as a deterministic tie breaker', () => {
    expect(
      compareLamport({ counter: 7, clientId: 'alpha' }, { counter: 7, clientId: 'beta' }),
    ).toBeLessThan(0)
  })

  it('advances beyond local and observed remote clocks', () => {
    expect(nextLamport(3, { counter: 8, clientId: 'remote' }, 'local')).toEqual({
      counter: 9,
      clientId: 'local',
    })
  })

  it('detects an overlapping pending and remote card field', () => {
    const local = {
      id: 'local-op',
      clientId: 'client-a',
      type: 'card/update',
      payload: { cardId: 'card-1', patch: { title: 'Local' } },
      baseVersion: 0,
      timestamp: 1,
      lamport: { counter: 1, clientId: 'client-a' },
    } satisfies Operation
    const remote = {
      ...local,
      id: 'remote-op',
      clientId: 'client-b',
      payload: { cardId: 'card-1', patch: { title: 'Remote' } },
      lamport: { counter: 1, clientId: 'client-b' },
    } satisfies Operation
    const separateField = {
      ...remote,
      payload: { cardId: 'card-1', patch: { description: 'Remote details' } },
    } satisfies Operation

    expect(operationsConflict(local, remote)).toBe(true)
    expect(operationsConflict(local, separateField)).toBe(false)
  })
})
