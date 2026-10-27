import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { search, type SearchHit } from '../api'

const PER_GROUP = 4

export default function GlobalSearch() {
  const nav = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    let live = true
    search.query(q).then(h => {
      if (!live) return
      // cap each group so one module can't flood the list
      const seen: Record<string, number> = {}
      setHits(h.filter(x => (seen[x.group] = (seen[x.group] ?? 0) + 1) <= PER_GROUP))
      setActive(0)
    })
    return () => { live = false }
  }, [q])

  useEffect(() => {
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); input.current?.focus() }
    }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [])

  const go = (h: SearchHit) => { setOpen(false); setQ(''); input.current?.blur(); nav(h.to) }
  const groups = [...new Set(hits.map(h => h.group))]

  return (
    <div ref={box} className="relative w-full max-w-2xl">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">⌕</span>
      <input ref={input} value={q} placeholder="Search leads, clients, matters, messages, documents…"
        onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && hits[active]) go(hits[active])
        }}
        className="w-full rounded-lg border border-white/15 bg-white/10 py-2 pl-9 pr-12 text-sm text-white placeholder-white/60 outline-none focus:border-white/40 focus:bg-white/15" />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/25 px-1.5 text-xs text-white/60">/</kbd>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
          {hits.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No results for “{q}”</p>}
          {groups.map(g => (
            <div key={g}>
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</p>
              {hits.filter(h => h.group === g).map(h => {
                const i = hits.indexOf(h)
                return (
                  <button key={i} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                    className={`block w-full px-4 py-2 text-left ${i === active ? 'bg-brand-50' : ''}`}>
                    <span className="block truncate text-sm font-medium text-slate-900">{h.title}</span>
                    <span className="block truncate text-xs text-slate-500">{h.subtitle}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
