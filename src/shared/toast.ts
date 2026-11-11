// Tiny event bus so any layer (including the mock backend) can show a toast.
type Listener = (t: { id: number; title: string; sub?: string }) => void
const listeners = new Set<Listener>()
let n = 0
export const toast = (title: string, sub?: string) => listeners.forEach(l => l({ id: ++n, title, sub }))
export const onToast = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l) } }
