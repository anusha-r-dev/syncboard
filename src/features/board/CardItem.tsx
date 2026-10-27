import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { boardActions } from './boardSlice'
import type { Card } from '../sync/types'

type CardItemProps = {
  card: Card
  virtual?: boolean
}

export function CardItem({ card, virtual = false }: CardItemProps) {
  const dispatch = useAppDispatch()
  const highlighted = useAppSelector(
    (state) => (state.board.highlightedCards[card.id] ?? 0) > Date.now(),
  )
  const editor = useAppSelector((state) =>
    Object.values(state.presence.remote).find(
      (person) => person.editingCardId === card.id,
    ),
  )
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `card:${card.id}`,
      data: { kind: 'card', cardId: card.id, columnId: card.columnId },
    })

  return (
    <article
      ref={setNodeRef}
      className={`card ${isDragging ? 'is-dragging' : ''} ${highlighted ? 'is-remote-updated' : ''} ${virtual ? 'is-virtual' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`card-${card.id}`}
    >
      <button
        className="card-body"
        onClick={() => dispatch(boardActions.cardSelected(card.id))}
      >
        <div className="label-row">
          {card.labels.map((label) => (
            <span className={`label label-${label.color}`} key={label.id}>
              {label.name}
            </span>
          ))}
        </div>
        <span className="card-title">{card.title}</span>
        {card.description && <p>{card.description}</p>}
        <footer>
          <span
            className="avatar avatar-small"
            aria-label={`Assigned to ${card.assignee}`}
          >
            {card.assignee.slice(0, 1)}
          </span>
        </footer>
      </button>
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Move ${card.title}. Press Space to lift, arrow keys to move, and Space to drop.`}
      >
        <GripVertical size={18} />
      </button>
      {editor && (
        <span className="editing-indicator" style={{ color: editor.color }}>
          {editor.name} is editing
        </span>
      )}
    </article>
  )
}
