import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Operation, PresenceState } from '../src/features/sync/types'

const supabase = vi.hoisted(() => {
  const handlers = new Map<string, (message: unknown) => void>()
  const send = vi.fn()
  const track = vi.fn()
  const removeChannel = vi.fn()
  let subscription: ((status: string) => void) | undefined
  const channel = {
    on: vi.fn(
      (_type: string, filter: { event: string }, handler: (message: unknown) => void) => {
        handlers.set(filter.event, handler)
        return channel
      },
    ),
    subscribe: vi.fn((callback: (status: string) => void) => {
      subscription = callback
      return channel
    }),
    send,
    track,
  }
  return {
    handlers,
    send,
    track,
    removeChannel,
    channel,
    subscribe(status: string) {
      subscription?.(status)
    },
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => supabase.channel),
    removeChannel: supabase.removeChannel,
  })),
}))

import { SupabaseTransport } from '../src/features/sync/SupabaseTransport'

const operation: Operation = {
  id: 'op-1',
  clientId: 'client-a',
  type: 'card/delete',
  payload: { cardId: 'card-1' },
  baseVersion: 1,
  timestamp: 10,
  lamport: { counter: 1, clientId: 'client-a' },
}

const presence: PresenceState = {
  clientId: 'client-a',
  name: 'Alex',
  color: '#123456',
  avatar: 'A',
  x: 1,
  y: 2,
  editingCardId: null,
  lastSeen: 10,
}

describe('SupabaseTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.handlers.clear()
    supabase.send.mockResolvedValue('ok')
    supabase.removeChannel.mockResolvedValue(undefined)
  })

  it('connects once and relays operation and presence broadcasts', async () => {
    const transport = new SupabaseTransport('https://example.supabase.co', 'key', 'me')
    const operations: Operation[] = []
    const people: PresenceState[] = []
    const stopOp = transport.onOp((item) => operations.push(item))
    const stopPresence = transport.onPresence((item) => people.push(item))

    await transport.connect()
    await transport.connect()
    supabase.subscribe('SUBSCRIBED')
    expect(transport.status).toBe('online')

    supabase.handlers.get('operation')?.({ payload: { value: operation } })
    supabase.handlers.get('presence-state')?.({ payload: { value: presence } })
    expect(operations).toEqual([operation])
    expect(people).toEqual([presence])

    stopOp()
    stopPresence()
    supabase.handlers.get('operation')?.({ payload: { value: operation } })
    expect(operations).toHaveLength(1)
  })

  it('sends operations and presence through the active channel', async () => {
    const transport = new SupabaseTransport('url', 'key', 'me')
    await transport.connect()
    await transport.send(operation)
    transport.setPresence(presence)

    expect(supabase.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'operation',
      payload: { value: operation },
    })
    expect(supabase.track).toHaveBeenCalledWith(presence)
    expect(supabase.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'presence-state',
      payload: { value: presence },
    })
  })

  it('reports failures, supports offline simulation, and disconnects', async () => {
    const transport = new SupabaseTransport('url', 'key', 'me')
    await transport.connect()
    supabase.subscribe('CHANNEL_ERROR')
    expect(transport.status).toBe('reconnecting')

    supabase.send.mockResolvedValueOnce('error')
    await expect(transport.send(operation)).rejects.toThrow('did not acknowledge')
    transport.configure({ forceFailure: true })
    await expect(transport.send(operation)).rejects.toThrow('simulated server')
    transport.configure({ forceFailure: false, offline: true })
    expect(transport.status).toBe('offline')
    await expect(transport.send(operation)).rejects.toThrow('offline')
    transport.setPresence(presence)

    await transport.disconnect()
    expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channel)
    expect(transport.status).toBe('offline')
  })
})
