import {
  createEntityAdapter,
  createSlice,
  type EntityState,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { seedBoard, seedCards, seedColumns } from '../../data/seed'
import { compareRanks } from './fractionalOrder'
import { shouldApplyRemoteField } from '../sync/conflictResolution'
import type { Board, Card, Column, Operation } from '../sync/types'

export type ApplySource = 'local' | 'remote' | 'rollback' | 'hydrate'

const boardsAdapter = createEntityAdapter<Board>({
  sortComparer: (a, b) => a.title.localeCompare(b.title),
})
const columnsAdapter = createEntityAdapter<Column>({ sortComparer: compareRanks })
const cardsAdapter = createEntityAdapter<Card>({ sortComparer: compareRanks })

export type BoardFeatureState = {
  boards: EntityState<Board, string>
  columns: EntityState<Column, string>
  cards: EntityState<Card, string>
  activeBoardId: string
  selectedCardId: string | null
  search: string
  labelFilter: string
  assigneeFilter: string
  highlightedCards: Record<string, number>
  announcement: string
}

export type BoardSnapshot = Pick<
  BoardFeatureState,
  'boards' | 'columns' | 'cards' | 'activeBoardId'
>

const initialState: BoardFeatureState = {
  boards: boardsAdapter.addOne(boardsAdapter.getInitialState(), seedBoard),
  columns: columnsAdapter.addMany(columnsAdapter.getInitialState(), seedColumns),
  cards: cardsAdapter.addMany(cardsAdapter.getInitialState(), seedCards),
  activeBoardId: seedBoard.id,
  selectedCardId: null,
  search: '',
  labelFilter: 'all',
  assigneeFilter: 'all',
  highlightedCards: {},
  announcement: 'SyncBoard loaded',
}

function applyCardPatch(
  card: Card,
  operation: Extract<Operation, { type: 'card/update' }>,
  source: ApplySource,
): boolean {
  let changed = false
  const { patch } = operation.payload
  const keys: Array<keyof typeof patch> = [
    'title',
    'description',
    'labels',
    'assignee',
    'columnId',
    'order',
  ]

  for (const key of keys) {
    const value = patch[key]
    if (value === undefined) continue
    const canApply =
      source !== 'remote' ||
      shouldApplyRemoteField(card.fieldClocks[key], operation.lamport)
    if (!canApply) continue

    if (key === 'labels') card.labels = value as Card['labels']
    else if (key === 'title') card.title = value as string
    else if (key === 'description') card.description = value as string
    else if (key === 'assignee') card.assignee = value as string
    else if (key === 'columnId') card.columnId = value as string
    else card.order = value as string

    card.fieldClocks[key] = operation.lamport
    changed = true
  }

  if (changed) {
    card.updatedAt = operation.timestamp
    card.version += 1
  }
  return changed
}

function applyColumnPatch(
  column: Column,
  operation: Extract<Operation, { type: 'column/update' }>,
  source: ApplySource,
): boolean {
  let changed = false
  const { patch } = operation.payload
  if (
    patch.title !== undefined &&
    (source !== 'remote' ||
      shouldApplyRemoteField(column.fieldClocks.title, operation.lamport))
  ) {
    column.title = patch.title
    column.fieldClocks.title = operation.lamport
    changed = true
  }
  if (
    patch.order !== undefined &&
    (source !== 'remote' ||
      shouldApplyRemoteField(column.fieldClocks.order, operation.lamport))
  ) {
    column.order = patch.order
    column.fieldClocks.order = operation.lamport
    changed = true
  }
  if (changed) {
    column.updatedAt = operation.timestamp
    column.version += 1
  }
  return changed
}

export const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    operationApplied(
      state,
      action: PayloadAction<{ operation: Operation; source: ApplySource }>,
    ) {
      const { operation, source } = action.payload
      switch (operation.type) {
        case 'card/create':
          cardsAdapter.upsertOne(state.cards, operation.payload.card)
          state.announcement = `${operation.payload.card.title} was added`
          break
        case 'card/createMany':
          cardsAdapter.upsertMany(state.cards, operation.payload.cards)
          state.announcement = `${operation.payload.cards.length.toLocaleString()} performance cards added`
          break
        case 'card/deleteMany':
          cardsAdapter.removeMany(state.cards, operation.payload.cardIds)
          state.announcement = 'Performance test cards removed'
          break
        case 'card/update': {
          const card = state.cards.entities[operation.payload.cardId]
          if (!card) break
          const changed = applyCardPatch(card, operation, source)
          if (changed && source === 'remote') {
            state.highlightedCards[card.id] = Date.now() + 1800
            state.announcement = `${card.title} was updated by ${operation.payload.actorName ?? 'a collaborator'}`
          }
          break
        }
        case 'card/delete':
          cardsAdapter.removeOne(state.cards, operation.payload.cardId)
          if (state.selectedCardId === operation.payload.cardId)
            state.selectedCardId = null
          state.announcement = 'Card deleted'
          break
        case 'column/create':
          columnsAdapter.upsertOne(state.columns, operation.payload.column)
          state.announcement = `${operation.payload.column.title} column added`
          break
        case 'column/restore':
          columnsAdapter.upsertOne(state.columns, operation.payload.column)
          cardsAdapter.upsertMany(state.cards, operation.payload.cards)
          state.announcement = `${operation.payload.column.title} column restored`
          break
        case 'column/update': {
          const column = state.columns.entities[operation.payload.columnId]
          if (column) applyColumnPatch(column, operation, source)
          break
        }
        case 'column/delete': {
          const cardIds = state.cards.ids.filter(
            (id) => state.cards.entities[id]?.columnId === operation.payload.columnId,
          )
          cardsAdapter.removeMany(state.cards, cardIds)
          columnsAdapter.removeOne(state.columns, operation.payload.columnId)
          state.announcement = 'Column and its cards deleted'
          break
        }
      }
    },
    snapshotHydrated(state, action: PayloadAction<BoardSnapshot>) {
      state.boards = action.payload.boards
      state.columns = action.payload.columns
      state.cards = action.payload.cards
      state.activeBoardId = action.payload.activeBoardId
      state.announcement = 'Saved board restored'
    },
    cardSelected(state, action: PayloadAction<string | null>) {
      state.selectedCardId = action.payload
    },
    searchChanged(state, action: PayloadAction<string>) {
      state.search = action.payload
    },
    labelFilterChanged(state, action: PayloadAction<string>) {
      state.labelFilter = action.payload
    },
    assigneeFilterChanged(state, action: PayloadAction<string>) {
      state.assigneeFilter = action.payload
    },
    expiredHighlightsCleared(state, action: PayloadAction<number>) {
      for (const [cardId, expiry] of Object.entries(state.highlightedCards)) {
        if (expiry <= action.payload) delete state.highlightedCards[cardId]
      }
    },
  },
})

export const boardActions = boardSlice.actions
export const boardReducer = boardSlice.reducer
export const boardAdapters = {
  boards: boardsAdapter,
  columns: columnsAdapter,
  cards: cardsAdapter,
}
