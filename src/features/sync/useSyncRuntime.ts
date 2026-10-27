import { useEffect } from 'react'
import { store } from '../../app/store'
import { startSyncRuntime } from './runtime'

export function useSyncRuntime(): void {
  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    void startSyncRuntime(store).then((cleanup) => {
      if (disposed) cleanup()
      else stop = cleanup
    })
    return () => {
      disposed = true
      stop?.()
    }
  }, [])
}
