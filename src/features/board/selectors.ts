import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import { boardAdapters } from './boardSlice'

const boardState = (state: RootState) => state.board

export const boardSelectors = boardAdapters.boards.getSelectors<RootState>(
  (state) => state.board.boards,
)
export const columnSelectors = boardAdapters.columns.getSelectors<RootState>(
  (state) => state.board.columns,
)
export const cardSelectors = boardAdapters.cards.getSelectors<RootState>(
  (state) => state.board.cards,
)

export const selectActiveBoard = createSelector(
  [boardSelectors.selectEntities, boardState],
  (entities, state) => entities[state.activeBoardId],
)

export const selectOrderedColumns = createSelector(
  [columnSelectors.selectAll],
  (columns) => [...columns].sort((a, b) => a.order.localeCompare(b.order)),
)

export const selectFilteredCards = createSelector(
  [cardSelectors.selectAll, boardState],
  (cards, state) => {
    const query = state.search.trim().toLocaleLowerCase()
    return cards.filter((card) => {
      const matchesSearch =
        query.length === 0 ||
        card.title.toLocaleLowerCase().includes(query) ||
        card.description.toLocaleLowerCase().includes(query)
      const matchesLabel =
        state.labelFilter === 'all' ||
        card.labels.some((label) => label.id === state.labelFilter)
      const matchesAssignee =
        state.assigneeFilter === 'all' || card.assignee === state.assigneeFilter
      return matchesSearch && matchesLabel && matchesAssignee
    })
  },
)

export const selectCardsByColumn = createSelector([selectFilteredCards], (cards) => {
  const grouped: Record<string, typeof cards> = {}
  for (const card of cards) {
    grouped[card.columnId] ??= []
    grouped[card.columnId]?.push(card)
  }
  for (const group of Object.values(grouped))
    group.sort((a, b) => a.order.localeCompare(b.order))
  return grouped
})

export const selectSelectedCard = createSelector(
  [cardSelectors.selectEntities, boardState],
  (entities, state) =>
    state.selectedCardId ? entities[state.selectedCardId] : undefined,
)

export const selectAssignees = createSelector([cardSelectors.selectAll], (cards) =>
  [...new Set(cards.map((card) => card.assignee))].sort(),
)
