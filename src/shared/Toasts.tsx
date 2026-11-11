import { useEffect, useState } from 'react'
import { onToast } from './toast'

interface T { id: number; title: string; sub?: string; out?: boolean }

export function Toasts() {
  const [list, setList] = useState<T[]>([])
  useEffect(() => onToast(t => {
    setList(l => [t, ...l].slice(0, 3))
    setTimeout(() => setList(l => l.map(x => (x.id === t.id ? { ...x, out: true } : x))), 3600)
    setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), 3840)
  }), [])
  return (
    <div className="toasts" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className={'toast' + (t.out ? ' is-out' : '')}>
          <span className="appicon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M5 3.5v7.2a5 5 0 0 0 10 0V3.5" /></svg></span>
          <div><b>{t.title}</b>{t.sub && <small>{t.sub}</small>}</div>
        </div>
      ))}
    </div>
  )
}
