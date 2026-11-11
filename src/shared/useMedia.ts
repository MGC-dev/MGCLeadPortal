import { useSyncExternalStore } from 'react'

const q = '(max-width: 760px)'
export const isPhone = () => matchMedia(q).matches
/** True on phone-sized screens (tab bar, bottom sheets). */
export function usePhone() {
  return useSyncExternalStore(
    cb => { const m = matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => matchMedia(q).matches,
  )
}
