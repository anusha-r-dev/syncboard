import type { Operation, PresenceState, SyncTransport, TransportOptions } from './types'

type ChannelMessage =
  | { kind: 'operation'; value: Operation }
  | { kind: 'operation-request' }
  | { kind: 'operation-history'; value: Operation[] }
  | { kind: 'presence'; value: PresenceState }
  | { kind: 'presence-request' }

export class BroadcastChannelTransport implements SyncTransport {
  readonly kind = 'broadcast-channel' as const
  private channel: BroadcastChannel | null = null
  private operationListeners = new Set<(operation: Operation) => void>()
  private presenceListeners = new Set<(presence: PresenceState) => void>()
  private lastPresence: PresenceState | null = null
  private operations = new Map<string, Operation>()
  private options: TransportOptions = {
    minLatency: 100,
    maxLatency: 300,
    offline: false,
    forceFailure: false,
  }

  get status() {
    if (this.options.offline) return 'offline' as const
    return this.channel ? ('online' as const) : ('reconnecting' as const)
  }

  connect(): Promise<void> {
    if (this.channel) return Promise.resolve()
    this.channel = new BroadcastChannel('syncboard-product-launch')
    this.channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const message = event.data
      if (this.options.offline) return
      if (message.kind === 'operation') {
        this.deliverOperation(message.value)
      } else if (message.kind === 'operation-history') {
        message.value.forEach((operation) => this.deliverOperation(operation))
      } else if (message.kind === 'operation-request') {
        this.channel?.postMessage({
          kind: 'operation-history',
          value: [...this.operations.values()],
        } satisfies ChannelMessage)
      } else if (message.kind === 'presence') {
        this.presenceListeners.forEach((listener) => listener(message.value))
      } else if (this.lastPresence && !this.options.offline) {
        this.channel?.postMessage({
          kind: 'presence',
          value: this.lastPresence,
        } satisfies ChannelMessage)
      }
    }
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this.channel?.close()
    this.channel = null
    return Promise.resolve()
  }

  async send(operation: Operation): Promise<void> {
    if (this.options.offline) throw new Error('Transport is offline')
    await this.waitForLatency()
    if (this.options.forceFailure)
      throw new Error('The simulated server rejected this change')
    this.rememberOperation(operation)
    this.channel?.postMessage({
      kind: 'operation',
      value: operation,
    } satisfies ChannelMessage)
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
    this.lastPresence = state
    if (!this.options.offline) {
      this.channel?.postMessage({
        kind: 'presence',
        value: state,
      } satisfies ChannelMessage)
      this.channel?.postMessage({ kind: 'presence-request' } satisfies ChannelMessage)
      this.channel?.postMessage({ kind: 'operation-request' } satisfies ChannelMessage)
    }
  }

  configure(options: Partial<TransportOptions>): void {
    const wasOffline = this.options.offline
    Object.assign(this.options, options)
    if (wasOffline && !this.options.offline) {
      this.channel?.postMessage({ kind: 'presence-request' } satisfies ChannelMessage)
      this.channel?.postMessage({ kind: 'operation-request' } satisfies ChannelMessage)
    }
  }

  private deliverOperation(operation: Operation): void {
    if (this.operations.has(operation.id)) return
    this.rememberOperation(operation)
    this.operationListeners.forEach((listener) => listener(operation))
  }

  private rememberOperation(operation: Operation): void {
    this.operations.set(operation.id, operation)
    if (this.operations.size > 10_000) {
      const oldestId = this.operations.keys().next().value
      if (oldestId) this.operations.delete(oldestId)
    }
  }

  private async waitForLatency(): Promise<void> {
    const spread = Math.max(0, this.options.maxLatency - this.options.minLatency)
    const delay = this.options.minLatency + Math.round(Math.random() * spread)
    await new Promise((resolve) => window.setTimeout(resolve, delay))
  }
}
