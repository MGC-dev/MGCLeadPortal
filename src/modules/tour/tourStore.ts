import { useSyncExternalStore } from 'react'

interface TourState { step: number; min: boolean; dismissed: boolean; leadId: string | null }
let s: TourState = { step: 0, min: matchMedia('(max-width: 760px)').matches, dismissed: false, leadId: null }
const ls = new Set<() => void>()
export const tourStore = {
  get: () => s,
  set(p: Partial<TourState>) { s = { ...s, ...p }; ls.forEach(l => l()) },
  restart() { tourStore.set({ step: 0, min: false, dismissed: false }) },
  subscribe: (l: () => void) => { ls.add(l); return () => { ls.delete(l) } },
}
export const useTour = () => useSyncExternalStore(tourStore.subscribe, tourStore.get)
