import { Moon, Redo2, Sun, Undo2, Users, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { redoRequested, undoRequested } from '../../features/sync/operationActions'

export function AppHeader() {
  const dispatch = useAppDispatch()
  const [dark, setDark] = useState(
    () => localStorage.getItem('syncboard-theme') === 'dark',
  )
  const local = useAppSelector((state) => state.presence.local)
  const remote = useAppSelector((state) => Object.values(state.presence.remote))
  const status = useAppSelector((state) => state.sync.status)
  const persistedRevision = useAppSelector((state) => state.sync.persistedRevision)
  const canUndo = useAppSelector((state) => state.history.past.length > 0)
  const canRedo = useAppSelector((state) => state.history.future.length > 0)
  const viewerCount = remote.length + 1
  const viewerLabel = `${viewerCount} ${viewerCount === 1 ? 'person' : 'people'} viewing`
  const connectionLabel =
    status === 'online' ? 'Connected' : status === 'offline' ? 'Offline' : 'Reconnecting'

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('syncboard-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <header className="app-header">
      <a className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          S
        </span>
        <span>
          <strong>SyncBoard</strong>
          <small>Collaborative workspace</small>
        </span>
      </a>
      <div className="header-actions">
        <button
          className="button button-ghost second-tab-button"
          onClick={() =>
            window.open(window.location.href, '_blank', 'noopener,noreferrer')
          }
        >
          <ExternalLink size={16} /> Open in a second tab
        </button>
        <div className="presence-stack" aria-label={viewerLabel} title={viewerLabel}>
          {[local, ...remote].slice(0, 4).map((person) => (
            <span
              className="avatar"
              style={{ background: person.color }}
              title={`${person.name} is viewing`}
              key={person.clientId}
            >
              {person.avatar}
            </span>
          ))}
          <span className="presence-count">
            <Users size={14} /> {viewerCount}
          </span>
        </div>
        <span
          className={`status-pill status-${status}`}
          data-testid="sync-status"
          data-persisted-revision={persistedRevision}
          aria-label={connectionLabel}
          title={connectionLabel}
        >
          <span /> {status[0]?.toUpperCase()}
          {status.slice(1)}
        </span>
        <button
          className="icon-button"
          onClick={() => dispatch(undoRequested())}
          disabled={!canUndo}
          aria-label="Undo last change"
          title="Undo (Ctrl/⌘ Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          className="icon-button"
          onClick={() => dispatch(redoRequested())}
          disabled={!canRedo}
          aria-label="Redo last change"
          title="Redo (Ctrl/⌘ Shift Z)"
        >
          <Redo2 size={18} />
        </button>
        <button
          className="icon-button"
          onClick={() => setDark((value) => !value)}
          aria-label={`Use ${dark ? 'light' : 'dark'} theme`}
          title={`Use ${dark ? 'light' : 'dark'} theme`}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
