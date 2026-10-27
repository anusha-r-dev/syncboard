import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { syncActions } from '../../features/sync/syncSlice'

export function Toasts() {
  const dispatch = useAppDispatch()
  const toasts = useAppSelector((state) => state.sync.toasts)

  useEffect(() => {
    if (!toasts[0]) return
    const timeout = window.setTimeout(
      () => dispatch(syncActions.toastRemoved(toasts[0]!.id)),
      3500,
    )
    return () => window.clearTimeout(timeout)
  }, [dispatch, toasts])

  return (
    <div
      className="toast-region"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          {toast.message}
          <button
            onClick={() => dispatch(syncActions.toastRemoved(toast.id))}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
