import { useEffect, useState, useSyncExternalStore } from 'react'
import { db } from './api/db'

/** Runs an async service call and re-runs it whenever any mutation commits to the DB. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const version = useSyncExternalStore(db.subscribe, db.version)
  const [data, setData] = useState<T>()
  useEffect(() => {
    let live = true
    fn().then(d => live && setData(d))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])
  return data
}
