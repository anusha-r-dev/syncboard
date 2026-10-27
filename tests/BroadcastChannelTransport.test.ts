import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BroadcastChannelTransport } from '../src/features/sync/BroadcastChannelTransport'
import type { Operation, PresenceState } from '../src/features/sync/types'

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  posts: unknown[] = []
  close = vi.fn()

  constructor(readonly name: string) {
    MockBroadcastChannel.instances.push(this)
  }

  postMessage(message: unknown) {
    this.posts.push(message)
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

const operation = (id = 'op-1'): Operation => ({
  id,
  clientId: 'client-a',
  type: 'card/delete',
  payload: { cardId: 'card-1' },
  baseVersion: 1,
  timestamp: 10,
  lamport: { counter: 2, clientId: 'client-a' },
})

const presence: PresenceState = {
  clientId: 'client-a',
  name: 'Alex',
  color: '#123456',
  avatar: 'A',
  x: 12,
  y: 18,
  editingCardId: null,
  lastSeen: 10,
}

describe('BroadcastChannelTransport', () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = []
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('connects, broadcasts operations, and disconnects cleanly', async () => {
    const transport = new BroadcastChannelTransport()
    transport.configure({ minLatency: 0, maxLatency: 0 })

    expect(transport.status).toBe('reconnecting')
    await transport.connect()
    await transport.connect()
    expect(MockBroadcastChannel.instances).toHaveLength(1)
    expect(transport.status).toBe('online')

    await transport.send(operation())
    expect(MockBroadcastChannel.instances[0]?.posts).toContainEqual({
      kind: 'operation',
      value: operation(),
    })

    await transport.disconnect()
    expect(MockBroadcastChannel.instances[0]?.close).toHaveBeenCalledOnce()
    expect(transport.status).toBe('reconnecting')
  })

  it('delivers each remote operation once, including history responses', async () => {
    const transport = new BroadcastChannelTransport()
    const received: string[] = []
    const unsubscribe = transport.onOp((item) => received.push(item.id))
    await transport.connect()
    const channel = MockBroadcastChannel.instances[0]

    channel?.emit({ kind: 'operation', value: operation('one') })
    channel?.emit({
      kind: 'operation-history',
      value: [operation('one'), operation('two')],
    })
    expect(received).toEqual(['one', 'two'])

    channel?.emit({ kind: 'operation-request' })
    expect(channel?.posts).toContainEqual({
      kind: 'operation-history',
      value: [operation('one'), operation('two')],
    })

    unsubscribe()
    channel?.emit({ kind: 'operation', value: operation('three') })
    expect(received).toEqual(['one', 'two'])
  })

  it('shares presence and answers another viewer presence request', async () => {
    const transport = new BroadcastChannelTransport()
    const received: PresenceState[] = []
    const unsubscribe = transport.onPresence((item) => received.push(item))
    await transport.connect()
    const channel = MockBroadcastChannel.instances[0]

    transport.setPresence(presence)
    expect(channel?.posts).toEqual([
      { kind: 'presence', value: presence },
      { kind: 'presence-request' },
      { kind: 'operation-request' },
    ])

    channel?.emit({ kind: 'presence', value: { ...presence, clientId: 'remote' } })
    expect(received[0]?.clientId).toBe('remote')
    channel?.emit({ kind: 'presence-request' })
    expect(channel?.posts.at(-1)).toEqual({ kind: 'presence', value: presence })

    unsubscribe()
  })

  it('rejects work while offline and requests catch-up after reconnecting', async () => {
    const transport = new BroadcastChannelTransport()
    await transport.connect()
    const channel = MockBroadcastChannel.instances[0]
    transport.configure({ offline: true })

    expect(transport.status).toBe('offline')
    await expect(transport.send(operation())).rejects.toThrow('offline')
    transport.setPresence(presence)
    channel?.emit({ kind: 'operation', value: operation() })
    expect(channel?.posts).toEqual([])

    transport.configure({ offline: false })
    expect(channel?.posts).toEqual([
      { kind: 'presence-request' },
      { kind: 'operation-request' },
    ])
  })

  it('surfaces a simulated server rejection', async () => {
    const transport = new BroadcastChannelTransport()
    transport.configure({ minLatency: 0, maxLatency: 0, forceFailure: true })
    await transport.connect()
    await expect(transport.send(operation())).rejects.toThrow('simulated server')
  })
})
