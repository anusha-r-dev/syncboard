import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { labels } from '../../data/seed'
import { boardActions } from './boardSlice'
import { selectAssignees } from './selectors'

export function BoardFilters() {
  const dispatch = useAppDispatch()
  const storedSearch = useAppSelector((state) => state.board.search)
  const labelFilter = useAppSelector((state) => state.board.labelFilter)
  const assigneeFilter = useAppSelector((state) => state.board.assigneeFilter)
  const assignees = useAppSelector(selectAssignees)
  const [search, setSearch] = useState(storedSearch)

  useEffect(() => {
    const timeout = window.setTimeout(
      () => dispatch(boardActions.searchChanged(search)),
      250,
    )
    return () => window.clearTimeout(timeout)
  }, [dispatch, search])

  const hasFilters = search || labelFilter !== 'all' || assigneeFilter !== 'all'

  return (
    <div className="filter-bar" aria-label="Board filters">
      <label className="search-field">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Search cards</span>
        <input
          type="search"
          value={search}
          placeholder="Search cards…"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="filter-select">
        <span>Label</span>
        <select
          value={labelFilter}
          onChange={(event) =>
            dispatch(boardActions.labelFilterChanged(event.target.value))
          }
        >
          <option value="all">All labels</option>
          {Object.values(labels).map((label) => (
            <option value={label.id} key={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-select">
        <span>Assignee</span>
        <select
          value={assigneeFilter}
          onChange={(event) =>
            dispatch(boardActions.assigneeFilterChanged(event.target.value))
          }
        >
          <option value="all">Everyone</option>
          {assignees.map((assignee) => (
            <option value={assignee} key={assignee}>
              {assignee}
            </option>
          ))}
        </select>
      </label>
      {hasFilters && (
        <button
          className="clear-filters"
          onClick={() => {
            setSearch('')
            dispatch(boardActions.labelFilterChanged('all'))
            dispatch(boardActions.assigneeFilterChanged('all'))
          }}
        >
          <X size={15} /> Clear
        </button>
      )}
    </div>
  )
}
