import { FlaskConical, Gauge, WifiOff } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useBoardCommands } from '../../features/board/useBoardCommands'
import { syncActions } from '../../features/sync/syncSlice'

export function DevPanel() {
  const dispatch = useAppDispatch()
  const options = useAppSelector((state) => state.sync.devOptions)
  const transport = useAppSelector((state) => state.sync.transportKind)
  const { performanceCardCount, toggleStressTest } = useBoardCommands()

  return (
    <details className="dev-panel">
      <summary>
        <FlaskConical size={16} /> Demo controls
      </summary>
      <div className="dev-panel-content">
        <p>
          Transport:{' '}
          <strong>{transport === 'supabase' ? 'Supabase' : 'Browser tabs'}</strong>
        </p>
        <label className="switch-row">
          <span>
            <WifiOff size={16} /> Simulate offline
          </span>
          <input
            type="checkbox"
            checked={options.offline}
            onChange={(event) =>
              dispatch(syncActions.devOptionsChanged({ offline: event.target.checked }))
            }
          />
        </label>
        <label className="switch-row">
          <span>
            <FlaskConical size={16} /> Force next failures
          </span>
          <input
            type="checkbox"
            checked={options.forceFailure}
            onChange={(event) =>
              dispatch(
                syncActions.devOptionsChanged({ forceFailure: event.target.checked }),
              )
            }
          />
        </label>
        <label className="latency-control">
          <span>
            <Gauge size={16} /> Simulated latency: {options.maxLatency}ms
          </span>
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={options.maxLatency}
            onChange={(event) =>
              dispatch(
                syncActions.devOptionsChanged({
                  minLatency: 100,
                  maxLatency: Number(event.target.value),
                }),
              )
            }
          />
        </label>
        <button className="button button-secondary" onClick={toggleStressTest}>
          {performanceCardCount > 0
            ? 'Clear stress-test cards'
            : 'Load 6,000-card stress test'}
        </button>
      </div>
    </details>
  )
}
