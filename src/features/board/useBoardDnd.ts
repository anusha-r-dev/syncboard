import { useState } from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useAppSelector } from '../../app/hooks'
import { rankBetween } from './fractionalOrder'
import { selectCardsByColumn, selectOrderedColumns } from './selectors'
import { useBoardCommands } from './useBoardCommands'

type DragData =
  | { kind: 'card'; cardId: string; columnId: string }
  | { kind: 'column'; columnId: string }

const announcements: Announcements = {
  onDragStart({ active }) {
    return `Picked up ${String(active.id).replace(/^(card|column):/, '')}`
  },
  onDragOver({ over }) {
    return over
      ? `Moving over ${String(over.id).replace(/^(card|column):/, '')}`
      : undefined
  },
  onDragEnd({ active, over }) {
    return over
      ? `Dropped ${String(active.id).replace(/^(card|column):/, '')}`
      : 'Movement cancelled'
  },
  onDragCancel() {
    return 'Movement cancelled'
  },
}

export function useBoardDnd() {
  const columns = useAppSelector(selectOrderedColumns)
  const cardsByColumn = useAppSelector(selectCardsByColumn)
  const allCards = useAppSelector((state) => state.board.cards.entities)
  const { updateCard, updateColumn } = useBoardCommands()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    if (!event.over || event.active.id === event.over.id) return
    const active = event.active.data.current as DragData | undefined
    const over = event.over.data.current as DragData | undefined
    if (!active || !over) return

    if (active.kind === 'column' && over.kind === 'column') {
      const targetIndex = columns.findIndex((column) => column.id === over.columnId)
      const remaining = columns.filter((column) => column.id !== active.columnId)
      const before = remaining[targetIndex - 1]
      const after = remaining[targetIndex]
      updateColumn(active.columnId, { order: rankBetween(before?.order, after?.order) })
      return
    }

    if (active.kind !== 'card') return
    const targetCards = [...(cardsByColumn[over.columnId] ?? [])]
      .filter((card) => card.id !== active.cardId)
      .sort((a, b) => a.order.localeCompare(b.order))
    const targetIndex =
      over.kind === 'card'
        ? Math.max(
            0,
            targetCards.findIndex((card) => card.id === over.cardId),
          )
        : targetCards.length
    const before = targetCards[targetIndex - 1]
    const after = targetCards[targetIndex]
    updateCard(active.cardId, {
      columnId: over.columnId,
      order: rankBetween(before?.order, after?.order),
    })
  }

  const activeCardId = activeId?.startsWith('card:') ? activeId.slice(5) : null

  return {
    activeId,
    activeCard: activeCardId ? allCards[activeCardId] : undefined,
    announcements,
    sensors,
    onDragStart,
    onDragEnd,
    onDragCancel: () => setActiveId(null),
  }
}
