import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { labels } from '../../data/seed'
import { Modal } from '../../shared/ui/Modal'
import { boardActions } from './boardSlice'
import { columnSelectors, selectSelectedCard } from './selectors'
import { useBoardCommands } from './useBoardCommands'
import type { Card, Column } from '../sync/types'

export function CardModal() {
  const dispatch = useAppDispatch()
  const card = useAppSelector(selectSelectedCard)
  const columns = useAppSelector(columnSelectors.selectAll)
  if (!card) return null
  const close = () => dispatch(boardActions.cardSelected(null))

  return <CardEditor card={card} columns={columns} close={close} key={card.id} />
}

function CardEditor({
  card,
  columns,
  close,
}: {
  card: Card
  columns: Column[]
  close: () => void
}) {
  const { updateCard, deleteCard, setEditingCard } = useBoardCommands()
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [assignee, setAssignee] = useState(card.assignee)

  useEffect(() => {
    setEditingCard(card.id)
    return () => setEditingCard(null)
  }, [card.id, setEditingCard])

  const save = () => {
    updateCard(card.id, { title: title.trim() || 'Untitled card', description, assignee })
    close()
  }

  return (
    <Modal title="Card details" onClose={close}>
      <form
        className="card-form"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            rows={5}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Assignee
            <input
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            />
          </label>
          <label>
            Column
            <select
              value={card.columnId}
              onChange={(event) => updateCard(card.id, { columnId: event.target.value })}
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Labels</legend>
          <div className="label-picker">
            {Object.values(labels).map((label) => {
              const checked = card.labels.some((item) => item.id === label.id)
              return (
                <label className={`label label-${label.color}`} key={label.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      updateCard(card.id, {
                        labels: checked
                          ? card.labels.filter((item) => item.id !== label.id)
                          : [...card.labels, label],
                      })
                    }
                  />
                  {label.name}
                </label>
              )
            })}
          </div>
        </fieldset>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-danger-ghost"
            onClick={() => {
              deleteCard(card.id)
              close()
            }}
          >
            <Trash2 size={16} /> Delete
          </button>
          <span className="action-spacer" />
          <button type="button" className="button button-ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  )
}
