import { useMemo } from 'react'
import { closestCorners, DndContext, DragOverlay } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { selectCardsByColumn, selectOrderedColumns } from './selectors'
import { BoardColumn } from './BoardColumn'
import { useBoardDnd } from './useBoardDnd'
import { useBoardCommands } from './useBoardCommands'

export function BoardView() {
  const columns = useAppSelector(selectOrderedColumns)
  const cardsByColumn = useAppSelector(selectCardsByColumn)
  const { addColumn } = useBoardCommands()
  const {
    activeId,
    activeCard,
    announcements,
    sensors,
    onDragStart,
    onDragEnd,
    onDragCancel,
  } = useBoardDnd()
  const columnIds = useMemo(
    () => columns.map((column) => `column:${column.id}`),
    [columns],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Press Space to lift an item. Use arrow keys to move it. Press Space again to drop, or Escape to cancel.',
        },
      }}
    >
      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
        <div className="board-scroll" data-testid="board">
          {columns.map((column) => (
            <BoardColumn
              column={column}
              cards={cardsByColumn[column.id] ?? []}
              key={column.id}
            />
          ))}
          <button className="add-column" onClick={addColumn}>
            <Plus size={18} /> Add column
          </button>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
        {activeCard ? (
          <div className="drag-card-overlay">
            <strong>{activeCard.title}</strong>
            <span>{activeCard.assignee}</span>
          </div>
        ) : activeId ? (
          <div className="drag-column-overlay">Moving column</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
