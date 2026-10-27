import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { Operation, PresenceState, SyncTransport, TransportOptions } from './types'

type BroadcastEnvelope<T> = { payload: { value: T } }

export class SupabaseTransport implements SyncTransport {
  readonly kind = 'supabase' as const
  private client: ReturnType<typeof createClient>
  private channel: RealtimeChannel | null = null
  private connectionStatus: 'online' | 'reconnecting' | 'offline' = 'reconnecting'
  private operationListeners = new Set<(operation: Operation) => void>()
  private presenceListeners = new Set<(presence: PresenceState) => void>()
  private options: TransportOptions = {
    minLatency: 0,
    maxLatency: 0,
    offline: false,
    forceFailure: false,
  }

  constructor(
    url: string,
    anonKey: string,
    private readonly clientId: string,
  ) {
    this.client = createClient(url, anonKey)
  }

  get status() {
    return this.options.offline ? ('offline' as const) : this.connectionStatus
  }

  connect(): Promise<void> {
    if (this.channel) return Promise.resolve()
    this.channel = this.client.channel('syncboard-product-launch', {
      config: { presence: { key: this.clientId } },
    })
    this.channel
      .on('broadcast', { event: 'operation' }, (message) => {
        const operation = (message as unknown as BroadcastEnvelope<Operation>).payload
          .value
        this.operationListeners.forEach((listener) => listener(operation))
      })
      .on('broadcast', { event: 'presence-state' }, (message) => {
        const presence = (message as unknown as BroadcastEnvelope<PresenceState>).payload
          .value
        this.presenceListeners.forEach((listener) => listener(presence))
      })
      .subscribe((status) => {
        this.connectionStatus =
          String(status) === 'SUBSCRIBED' ? 'online' : 'reconnecting'
      })
    return Promise.resolve()
  }

  async disconnect(): Promise<void> {
    if (this.channel) await this.client.removeChannel(this.channel)
    this.channel = null
    this.connectionStatus = 'offline'
  }

  async send(operation: Operation): Promise<void> {
    if (this.options.offline) throw new Error('Transport is offline')
    if (this.options.forceFailure)
      throw new Error('The simulated server rejected this change')
    const response = await this.channel?.send({
      type: 'broadcast',
      event: 'operation',
      payload: { value: operation },
    })
    if (String(response) !== 'ok')
      throw new Error('Supabase did not acknowledge the operation')
  }

  onOp(callback: (operation: Operation) => void): () => void {
    this.operationListeners.add(callback)
    return () => this.operationListeners.delete(callback)
  }

  onPresence(callback: (presence: PresenceState) => void): () => void {
    this.presenceListeners.add(callback)
    return () => this.presenceListeners.delete(callback)
  }

  setPresence(state: PresenceState): void {
    if (!this.options.offline) {
      void this.channel?.track(state)
      void this.channel?.send({
        type: 'broadcast',
        event: 'presence-state',
        payload: { value: state },
      })
    }
  }

  configure(options: Partial<TransportOptions>): void {
    Object.assign(this.options, options)
  }
}
