import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { presenceActions } from './presenceSlice'

export function PresenceLayer() {
  const dispatch = useAppDispatch()
  const remote = useAppSelector((state) => Object.values(state.presence.remote))

  useEffect(() => {
    let lastSent = 0
    const onMove = (event: PointerEvent) => {
      const now = performance.now()
      if (now - lastSent < 33) return
      lastSent = now
      dispatch(
        presenceActions.localPresencePatched({ x: event.clientX, y: event.clientY }),
      )
    }
    window.addEventListener('pointermove', onMove)
    const cleanup = window.setInterval(() => {
      dispatch(presenceActions.localPresencePatched({}))
      dispatch(presenceActions.stalePresenceRemoved(Date.now() - 10_000))
    }, 4000)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.clearInterval(cleanup)
    }
  }, [dispatch])

  return (
    <div className="presence-layer" aria-hidden="true">
      {remote.map((person) => (
        <div
          className="remote-cursor"
          key={person.clientId}
          style={{ transform: `translate3d(${person.x}px, ${person.y}px, 0)` }}
        >
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
            <path
              d="M2 2L18 13H10L6 21L2 2Z"
              fill={person.color}
              stroke="white"
              strokeWidth="2"
            />
          </svg>
          <span style={{ background: person.color }}>{person.name}</span>
        </div>
      ))}
    </div>
  )
}
