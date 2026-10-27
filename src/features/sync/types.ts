export type LamportTimestamp = {
  counter: number
  clientId: string
}

export type ConnectionStatus = 'online' | 'reconnecting' | 'offline'

export type Label = {
  id: string
  name: string
  color: 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'
}

export type Board = {
  id: string
  title: string
  description: string
  updatedAt: number
  version: number
}

export type Column = {
  id: string
  boardId: string
  title: string
  order: string
  updatedAt: number
  version: number
  fieldClocks: Record<string, LamportTimestamp>
}

export type Card = {
  id: string
  title: string
  description: string
  labels: Label[]
  assignee: string
  columnId: string
  order: string
  updatedAt: number
  version: number
  fieldClocks: Record<string, LamportTimestamp>
}

export type CardPatch = Partial<
  Pick<Card, 'title' | 'description' | 'labels' | 'assignee' | 'columnId' | 'order'>
>

export type ColumnPatch = Partial<Pick<Column, 'title' | 'order'>>

export type OperationPayloadMap = {
  'card/create': { card: Card }
  'card/createMany': { cards: Card[] }
  'card/deleteMany': { cardIds: string[] }
  'card/update': { cardId: string; patch: CardPatch; actorName?: string }
  'card/delete': { cardId: string }
  'column/create': { column: Column }
  'column/restore': { column: Column; cards: Card[] }
  'column/update': { columnId: string; patch: ColumnPatch; actorName?: string }
  'column/delete': { columnId: string }
}

export type OperationType = keyof OperationPayloadMap

type OperationBase = {
  id: string
  clientId: string
  baseVersion: number
  timestamp: number
  lamport: LamportTimestamp
  undoOf?: string
}

export type Operation = {
  [K in OperationType]: OperationBase & {
    type: K
    payload: OperationPayloadMap[K]
  }
}[OperationType]

export type OperationDraft = {
  [K in OperationType]: {
    type: K
    payload: OperationPayloadMap[K]
  }
}[OperationType]

export type PresenceState = {
  clientId: string
  name: string
  color: string
  avatar: string
  x: number
  y: number
  editingCardId: string | null
  lastSeen: number
}

export type TransportOptions = {
  minLatency: number
  maxLatency: number
  offline: boolean
  forceFailure: boolean
}

export interface SyncTransport {
  readonly kind: 'broadcast-channel' | 'supabase'
  readonly status: ConnectionStatus
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(operation: Operation): Promise<void>
  onOp(callback: (operation: Operation) => void): () => void
  onPresence(callback: (presence: PresenceState) => void): () => void
  setPresence(state: PresenceState): void
  configure(options: Partial<TransportOptions>): void
}
