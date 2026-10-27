import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { BoardFilters } from './features/board/BoardFilters'
import { CardModal } from './features/board/CardModal'
import { BoardView } from './features/board/BoardView'
import { selectActiveBoard, selectFilteredCards } from './features/board/selectors'
import { PresenceLayer } from './features/presence/PresenceLayer'
import { redoRequested, undoRequested } from './features/sync/operationActions'
import { useSyncRuntime } from './features/sync/useSyncRuntime'
import { AppHeader } from './shared/ui/AppHeader'
import { DevPanel } from './shared/ui/DevPanel'
import { GuidedTour } from './shared/ui/GuidedTour'
import { Toasts } from './shared/ui/Toasts'
import './styles.css'

export default function App() {
  const dispatch = useAppDispatch()
  const board = useAppSelector(selectActiveBoard)
  const filteredCards = useAppSelector(selectFilteredCards)
  const totalCards = useAppSelector((state) => state.board.cards.ids.length)
  const queuedCount = useAppSelector((state) => state.sync.queuedCount)
  const status = useAppSelector((state) => state.sync.status)
  const announcement = useAppSelector((state) => state.board.announcement)

  useSyncRuntime()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      dispatch(event.shiftKey ? redoRequested() : undoRequested())
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dispatch])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#board-content">
        Skip to board
      </a>
      <AppHeader />
      {status === 'offline' && (
        <div className="offline-banner" role="status">
          Offline — {queuedCount} {queuedCount === 1 ? 'change' : 'changes'} pending. They
          will sync when you reconnect.
        </div>
      )}
      <main id="board-content">
        <section className="board-heading" aria-labelledby="board-title">
          <div>
            <span className="workspace-label">Nimbus workspace / Product</span>
            <h1 id="board-title">{board?.title ?? 'Product launch'}</h1>
            <p>{board?.description}</p>
          </div>
          <DevPanel />
        </section>
        <BoardFilters />
        <div className="result-summary">
          Showing {filteredCards.length.toLocaleString()} of {totalCards.toLocaleString()}{' '}
          cards
        </div>
        {filteredCards.length === 0 ? (
          <section className="empty-search" role="status">
            <div aria-hidden="true">⌕</div>
            <h2>No cards match those filters</h2>
            <p>Try a broader search, another label, or a different assignee.</p>
          </section>
        ) : (
          <BoardView />
        )}
      </main>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      <CardModal />
      <PresenceLayer />
      <GuidedTour />
      <Toasts />
    </div>
  )
}
