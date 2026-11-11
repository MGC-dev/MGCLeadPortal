import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../api'
import type { SearchHit } from '../api/types'
import { Icon } from '../shared/Icon'
import { VIEWS } from './nav'
import { useUi } from './UiContext'

const GROUP_ICON: Record<string, string> = { Pages: 'arrow', Leads: 'leads', Tasks: 'tasks', Messages: 'messages', Documents: 'folder', Services: 'services', Campaigns: 'campaigns' }
interface Item { group: string; title: string; subtitle: string; run: () => void }

/** Overall search in the top bar: leads, tasks, messages, documents, campaigns, and jump-to-page. Press / or Cmd/Ctrl+K. */
export function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { openLead, openModal, openService } = useUi()

  useEffect(() => {
    let live = true
    searchApi.query(q).then(h => { if (live) { setHits(h); setActive(0) } })
    return () => { live = false }
  }, [q])

  useEffect(() => {
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); input.current?.focus(); setOpen(true) }
    }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [])

  const close = () => { setOpen(false); setQ(''); input.current?.blur() }
  const items: Item[] = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const pages = VIEWS.filter(v => v.label.toLowerCase().includes(term)).map<Item>(v => ({ group: 'Pages', title: v.label, subtitle: v.sub, run: () => navigate(v.path) }))
    const found = hits.map<Item>(h => ({
      group: h.group, title: h.title, subtitle: h.subtitle,
      run: () => {
        if (h.target.type === 'lead') openLead(h.target.id)
        else if (h.target.type === 'tasks') navigate('/tasks')
        else if (h.target.type === 'document') navigate(`/documents/${h.target.id}`)
        else if (h.target.type === 'service') { navigate('/services'); setTimeout(() => openService(h.target.id), 120) } // after the route change, which closes open panels
        else navigate(`/campaigns/${h.target.id}`)
      },
    }))
    return [...pages, ...found]
  }, [q, hits, navigate, openLead, openModal, openService])

  const go = (i: Item) => { close(); i.run() }
  const groups = [...new Set(items.map(i => i.group))]
  const showList = open && q.trim().length > 0

  return (
    <div className="gsearch" ref={box} role="search">
      <label className="gsearch__field">
        <Icon name="leads" small />
        <span className="vh">Search the portal</span>
        <input ref={input} type="search" value={q} autoComplete="off" placeholder="Search leads, tasks, messages, documents…"
          onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') close()
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]) }
          }} />
        <kbd className="only-desk">/</kbd>
      </label>
      {showList && (
        <div className="gsearch__list" role="listbox">
          {items.length === 0 && <p className="gsearch__none">No results for “{q}”</p>}
          {groups.map(g => (
            <div key={g}>
              <p className="gsearch__group">{g}</p>
              {items.filter(i => i.group === g).map(i => {
                const idx = items.indexOf(i)
                return (
                  <button key={idx} type="button" role="option" aria-selected={idx === active} className={'gsearch__item' + (idx === active ? ' is-active' : '')}
                    onMouseEnter={() => setActive(idx)} onClick={() => go(i)}>
                    <span className="gsearch__icon"><Icon name={GROUP_ICON[g]} small /></span>
                    <span className="gsearch__text"><b>{i.title}</b><span>{i.subtitle}</span></span>
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
