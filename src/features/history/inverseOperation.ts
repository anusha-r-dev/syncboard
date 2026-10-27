import type { BoardFeatureState } from '../board/boardSlice'
import type { Operation, OperationDraft } from '../sync/types'

export function createInverseOperation(
  state: BoardFeatureState,
  operation: Operation,
): OperationDraft | null {
  switch (operation.type) {
    case 'card/create':
      return { type: 'card/delete', payload: { cardId: operation.payload.card.id } }
    case 'card/createMany':
    case 'card/deleteMany':
      return null
    case 'card/update': {
      const card = state.cards.entities[operation.payload.cardId]
      if (!card) return null
      const patch: Extract<OperationDraft, { type: 'card/update' }>['payload']['patch'] =
        {}
      if (operation.payload.patch.title !== undefined) patch.title = card.title
      if (operation.payload.patch.description !== undefined)
        patch.description = card.description
      if (operation.payload.patch.labels !== undefined) patch.labels = card.labels
      if (operation.payload.patch.assignee !== undefined) patch.assignee = card.assignee
      if (operation.payload.patch.columnId !== undefined) patch.columnId = card.columnId
      if (operation.payload.patch.order !== undefined) patch.order = card.order
      return { type: 'card/update', payload: { cardId: card.id, patch } }
    }
    case 'card/delete': {
      const card = state.cards.entities[operation.payload.cardId]
      return card
        ? { type: 'card/create', payload: { card: structuredClone(card) } }
        : null
    }
    case 'column/create':
      return { type: 'column/delete', payload: { columnId: operation.payload.column.id } }
    case 'column/restore':
      return {
        type: 'column/delete',
        payload: { columnId: operation.payload.column.id },
      }
    case 'column/update': {
      const column = state.columns.entities[operation.payload.columnId]
      if (!column) return null
      const patch: Extract<
        OperationDraft,
        { type: 'column/update' }
      >['payload']['patch'] = {}
      if (operation.payload.patch.title !== undefined) patch.title = column.title
      if (operation.payload.patch.order !== undefined) patch.order = column.order
      return { type: 'column/update', payload: { columnId: column.id, patch } }
    }
    case 'column/delete': {
      const column = state.columns.entities[operation.payload.columnId]
      if (!column) return null
      const cards = state.cards.ids
        .map((id) => state.cards.entities[id])
        .filter((card): card is NonNullable<typeof card> => card?.columnId === column.id)
        .map((card) => structuredClone(card))
      return {
        type: 'column/restore',
        payload: { column: structuredClone(column), cards },
      }
    }
  }
}
