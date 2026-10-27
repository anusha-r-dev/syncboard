import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react'
import type { Card, Column } from '../sync/types'
import { CardItem } from './CardItem'
import { useBoardCommands } from './useBoardCommands'

type BoardColumnProps = {
  column: Column
  cards: Card[]
}

const CARD_HEIGHT = 174

function CardWindow({ cards }: { cards: Card[] }) {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(360)
  const viewportRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setViewportHeight(Math.max(1, viewport.clientHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])
  const start = Math.max(0, Math.floor(scrollTop / CARD_HEIGHT) - 2)
  const end = Math.min(
    cards.length,
    Math.ceil((scrollTop + viewportHeight) / CARD_HEIGHT) + 2,
  )
  const visible = cards.slice(start, end)

  return (
    <div
      ref={viewportRef}
      className="virtual-window"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      data-testid="virtualized-column"
    >
      <div style={{ height: cards.length * CARD_HEIGHT, position: 'relative' }}>
        {visible.map((card, index) => (
          <div
            key={card.id}
            style={
              {
                position: 'absolute',
                insetInline: 0,
                top: (start + index) * CARD_HEIGHT,
                height: CARD_HEIGHT,
              } satisfies CSSProperties
            }
          >
            <CardItem card={card} virtual />
          </div>
        ))}
      </div>
    </div>
  )
}

export function BoardColumn({ column, cards }: BoardColumnProps) {
  const { addCard, updateColumn, deleteColumn } = useBoardCommands()
  const [menuOpen, setMenuOpen] = useState(false)
  const cardIds = useMemo(() => cards.map((card) => `card:${card.id}`), [cards])
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: `column:${column.id}`,
      data: { kind: 'column', columnId: column.id },
    })

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-labelledby={`column-title-${column.id}`}
      data-testid={`column-${column.id}`}
    >
      <header className="column-header">
        <button
          className="column-drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Move ${column.title} column. Press Space to lift, arrow keys to move, and Space to drop.`}
        >
          <GripVertical size={16} />
        </button>
        <span className="column-dot" />
        <input
          id={`column-title-${column.id}`}
          value={column.title}
          aria-label={`${column.title} column title`}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => updateColumn(column.id, { title: event.target.value })}
        />
        <span className="column-count">{cards.length}</span>
        <button
          className="icon-button"
          aria-label={`More options for ${column.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div className="column-menu">
            <button onClick={() => deleteColumn(column.id)}>Delete column</button>
          </div>
        )}
      </header>
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          className={`card-list ${cards.length > 100 ? 'is-virtualized' : ''}`}
          aria-label={`${column.title} cards`}
        >
          {cards.length > 100 ? (
            <CardWindow cards={cards} />
          ) : (
            cards.map((card) => <CardItem card={card} key={card.id} />)
          )}
          {cards.length === 0 && (
            <p className="column-empty">Drop a card here or add a new one.</p>
          )}
        </div>
      </SortableContext>
      <button
        className="add-card-button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => addCard(column.id)}
      >
        <Plus size={16} /> Add card
      </button>
    </section>
  )
}
