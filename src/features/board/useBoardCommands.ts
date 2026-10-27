import { useCallback, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { labels } from '../../data/seed'
import { presenceActions } from '../presence/presenceSlice'
import { operationRequested } from '../sync/operationActions'
import type { Card, CardPatch, Column, ColumnPatch } from '../sync/types'
import { rankBetween, ranksAfter } from './fractionalOrder'
import { cardSelectors, columnSelectors } from './selectors'

const blankClock = { counter: 0, clientId: 'local' }
export const isPerformanceCard = (card: Card): boolean =>
  card.id.startsWith('performance-') || card.title.startsWith('Performance sample ')

export function useBoardCommands() {
  const dispatch = useAppDispatch()
  const cards = useAppSelector(cardSelectors.selectAll)
  const columns = useAppSelector(columnSelectors.selectAll)
  const actorName = useAppSelector((state) => state.presence.local.name)

  const addCard = useCallback(
    (columnId: string) => {
      const siblings = cards
        .filter((card) => card.columnId === columnId)
        .sort((a, b) => a.order.localeCompare(b.order))
      const card: Card = {
        id: crypto.randomUUID(),
        title: 'Untitled card',
        description: '',
        labels: [labels.product].filter((label) => !!label),
        assignee: actorName,
        columnId,
        order: rankBetween(siblings.at(-1)?.order, undefined),
        updatedAt: Date.now(),
        version: 0,
        fieldClocks: {
          title: blankClock,
          description: blankClock,
          labels: blankClock,
          assignee: blankClock,
          columnId: blankClock,
          order: blankClock,
        },
      }
      dispatch(operationRequested({ draft: { type: 'card/create', payload: { card } } }))
      return card.id
    },
    [actorName, cards, dispatch],
  )

  const updateCard = useCallback(
    (cardId: string, patch: CardPatch) => {
      dispatch(
        operationRequested({
          draft: { type: 'card/update', payload: { cardId, patch, actorName } },
        }),
      )
    },
    [actorName, dispatch],
  )

  const deleteCard = useCallback(
    (cardId: string) => {
      dispatch(
        operationRequested({ draft: { type: 'card/delete', payload: { cardId } } }),
      )
    },
    [dispatch],
  )

  const addColumn = useCallback(() => {
    const ordered = [...columns].sort((a, b) => a.order.localeCompare(b.order))
    const column: Column = {
      id: crypto.randomUUID(),
      boardId: 'product-launch',
      title: 'New column',
      order: rankBetween(ordered.at(-1)?.order, undefined),
      updatedAt: Date.now(),
      version: 0,
      fieldClocks: { title: blankClock, order: blankClock },
    }
    dispatch(
      operationRequested({ draft: { type: 'column/create', payload: { column } } }),
    )
  }, [columns, dispatch])

  const updateColumn = useCallback(
    (columnId: string, patch: ColumnPatch) => {
      dispatch(
        operationRequested({
          draft: { type: 'column/update', payload: { columnId, patch, actorName } },
        }),
      )
    },
    [actorName, dispatch],
  )

  const deleteColumn = useCallback(
    (columnId: string) => {
      dispatch(
        operationRequested({ draft: { type: 'column/delete', payload: { columnId } } }),
      )
    },
    [dispatch],
  )

  const setEditingCard = useCallback(
    (cardId: string | null) => {
      dispatch(presenceActions.localPresencePatched({ editingCardId: cardId }))
    },
    [dispatch],
  )

  const performanceCardIds = useMemo(
    () => cards.filter(isPerformanceCard).map((card) => card.id),
    [cards],
  )

  const toggleStressTest = useCallback(() => {
    if (performanceCardIds.length > 0) {
      dispatch(
        operationRequested({
          draft: {
            type: 'card/deleteMany',
            payload: { cardIds: performanceCardIds },
          },
          recordHistory: false,
        }),
      )
      return
    }
    const columnId = columns[0]?.id
    if (!columnId) return
    const existingCards = cards
      .filter((card) => card.columnId === columnId)
      .sort((a, b) => a.order.localeCompare(b.order))
    const generatedRanks = ranksAfter(existingCards.at(-1)?.order, 6000)
    const generatedCards: Card[] = Array.from({ length: 6000 }, (_, index) => ({
      id: `performance-${index + 1}`,
      title: `Performance sample ${index + 1}`,
      description:
        'Generated locally to demonstrate windowed rendering at catalog scale.',
      labels: [labels.engineering].filter((label) => !!label),
      assignee: ['Alex', 'Maya', 'Jordan', 'Nora'][index % 4] ?? 'Alex',
      columnId,
      order: generatedRanks[index] ?? rankBetween(existingCards.at(-1)?.order),
      updatedAt: Date.now() + index,
      version: 0,
      fieldClocks: {
        title: blankClock,
        description: blankClock,
        labels: blankClock,
        assignee: blankClock,
        columnId: blankClock,
        order: blankClock,
      },
    }))
    dispatch(
      operationRequested({
        draft: { type: 'card/createMany', payload: { cards: generatedCards } },
        recordHistory: false,
      }),
    )
  }, [cards, columns, dispatch, performanceCardIds])

  return {
    addCard,
    updateCard,
    deleteCard,
    addColumn,
    updateColumn,
    deleteColumn,
    setEditingCard,
    performanceCardCount: performanceCardIds.length,
    toggleStressTest,
  }
}
