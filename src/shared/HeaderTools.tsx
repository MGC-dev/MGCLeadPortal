import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconArrowsSort, IconCheck, IconFilter, IconLayoutColumns, IconPlus, IconSearch, IconX } from '@tabler/icons-react'
import { config } from '../api/mockData'
import { useUi } from '../app/UiContext'
import { Icon } from './Icon'
import { usePhone } from './useMedia'
import { initials } from './format'


/** Where to place a floating menu that is anchored under a button: fixed to the viewport so scrolling tables cannot clip it. */
function useAnchoredStyle(open: boolean, anchor: React.RefObject<HTMLElement | null>, enabled: boolean): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>()
  useLayoutEffect(() => {
    if (!open || !enabled || !anchor.current) return
    const r = anchor.current.getBoundingClientRect()
    const below = innerHeight - r.bottom - 16, above = r.top - 16
    const flip = below < 280 && above > below
    const narrow = innerWidth <= 760
    setStyle({
      position: 'fixed', zIndex: 90,
      // on phones the menu spans the screen (minus a margin); otherwise it hangs from the button's right edge
      left: narrow ? 8 : 'auto', right: narrow ? 8 : Math.max(8, innerWidth - r.right), width: narrow ? 'auto' : undefined,
      top: flip ? 'auto' : r.bottom + 8, bottom: flip ? innerHeight - r.top + 8 : 'auto', maxHeight: Math.min(flip ? above : below, 460),
    })
  }, [open, enabled, anchor])
  return enabled ? style : undefined
}

/** Closes a floating menu on outside click, Escape, resize or when the page scrolls. */
function useDismiss(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[], closeOnScroll: boolean) {
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!refs.some(r => r.current?.contains(e.target as Node))) close() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    // only a scroll of the page itself dismisses the menu; scrolling inside a table does not (the button is pinned)
    const move = (e: Event) => { if (e.target === document) close() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key, true)
    window.addEventListener('resize', close)
    if (closeOnScroll) window.addEventListener('scroll', move, true)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', close); window.removeEventListener('scroll', move, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closeOnScroll])
}

const portalHost = (): HTMLElement | null => (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.portal') : null)

export interface FilterOption { value: string; label: string; /** Text in the round badge; omit for the default icon, null for no badge. */ badge?: string | null }
export interface FilterSection { title: string; value: string; onChange: (v: string) => void; options: FilterOption[] }

/** Filter icon: opens a menu with one or more filter groups. A dot shows when any group is not on its first option. */
export function FilterMenu({ sections, label, activeLabel, icon = 'filter', resetLabel = 'Clear filters', floating = false, compact = false }: { sections: FilterSection[]; label: string; activeLabel?: string; icon?: 'filter' | 'sort'; resetLabel?: string; /** Float above the page (for use inside scrolling tables). */ floating?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const phone = usePhone()
  floating = floating || phone
  useDismiss(open, () => setOpen(false), [box, list], floating)
  const floatStyle = useAnchoredStyle(open, box, floating)
  const wrap = (node: ReactNode) => (floating && portalHost() ? createPortal(node, portalHost()!) : node)
  const single = sections.length === 1
  const active = sections.some(sec => sec.value !== sec.options[0].value)
  const reset = () => sections.forEach(sec => sec.onChange(sec.options[0].value))
  return (
    <div className="filterpop" ref={box}>
      <button type="button" className={'iconbtn' + (compact ? ' iconbtn--sm' : '') + (active ? ' is-on' : '')} aria-haspopup="menu" aria-expanded={open}
        aria-label={active ? (activeLabel ?? label) : label} title={label} onClick={() => setOpen(o => !o)}>
        {icon === 'sort' ? <IconArrowsSort size={compact ? 16 : 18} stroke={1.9} /> : <IconFilter size={compact ? 16 : 18} stroke={1.9} />}
        {active && <i className="iconbtn__dot" aria-hidden="true" />}
      </button>
      {open && (!floating || floatStyle) && wrap(
        <div ref={list} style={floatStyle} className={'filterpop__list' + (single ? '' : ' is-multi')} role="menu" aria-label={label}>
          {sections.map((sec, si) => (
            <ul key={sec.title} className="filterpop__group" role="group" aria-label={sec.title}>
              {si > 0 && <li className="filterpop__rule" aria-hidden="true" />}
              <li className="filterpop__title">{sec.title}</li>
              {sec.options.map(o => (
                <li key={o.value}>
                  <button type="button" role="menuitemradio" aria-checked={sec.value === o.value} className="filterpop__item"
                    onClick={() => { sec.onChange(o.value); if (single) setOpen(false) }}>
                    {o.badge !== null && <span className="filterpop__avatar" aria-hidden="true">{o.badge ?? <Icon name="leads" small />}</span>}
                    <span>{o.label}</span>
                    {sec.value === o.value && <IconCheck className="filterpop__check" size={16} stroke={2.4} />}
                  </button>
                </li>
              ))}
            </ul>
          ))}
          {!single && active && <button type="button" className="filterpop__clear" onClick={reset}>{resetLabel}</button>}
        </div>
      )}
    </div>
  )
}

const ownerOptions: FilterOption[] = [{ value: 'all', label: 'Everyone' }, ...config.owners.map(o => ({ value: o, label: o, badge: initials(o) }))]
export const OWNER_SECTION = (owner: string, onChange: (o: string) => void): FilterSection => ({ title: 'Owner', value: owner, onChange, options: ownerOptions })

/** Filter icon that shows one owner's leads. */
export function OwnerFilter({ owner, onChange }: { owner: string; onChange: (o: string) => void }) {
  return <FilterMenu label="Filter by owner" activeLabel={`Filtered to ${owner}`} sections={[OWNER_SECTION(owner, onChange)]} />
}

/** Search icon: expands into a field when clicked and collapses again when empty. */
export function ExpandingSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const expanded = open || value.length > 0
  useEffect(() => { if (open) input.current?.focus() }, [open])
  return (
    <div className={'xsearch' + (expanded ? ' is-open' : '')}>
      <button type="button" className="iconbtn" aria-label="Search leads" title="Search leads" aria-expanded={expanded} onClick={() => setOpen(true)}>
        <IconSearch size={18} stroke={1.9} />
      </button>
      <input ref={input} type="search" tabIndex={expanded ? 0 : -1} aria-label="Search name, matter or practice area"
        placeholder="Search name, matter or practice area" value={value} autoComplete="off"
        onChange={e => onChange(e.target.value)} onBlur={() => { if (!value) setOpen(false) }}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onChange(''); setOpen(false); input.current?.blur() } }} />
      {value && (
        <button type="button" className="xsearch__clear" aria-label="Clear search" onClick={() => { onChange(''); input.current?.focus() }}>
          <IconX size={14} stroke={2.4} />
        </button>
      )}
    </div>
  )
}

/** The blue plus icon that opens the Add Enquiry dialog. */
export function AddEnquiryButton() {
  const { openModal } = useUi()
  return (
    <button type="button" className="iconbtn iconbtn--primary" aria-label="Add enquiry" title="Add enquiry" onClick={() => openModal({ type: 'intake' })}>
      <IconPlus size={19} stroke={2.2} />
    </button>
  )
}


export interface ColumnDef { id: string; label: string; /** Always shown; cannot be switched off. */ locked?: boolean }

/** Columns icon: tick which table columns to show. */
export function ColumnsMenu({ columns, visible, defaults, onChange, floating = false, compact = false }: { columns: ColumnDef[]; visible: string[]; defaults: string[]; onChange: (ids: string[]) => void; floating?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const phone = usePhone()
  floating = floating || phone
  useDismiss(open, () => setOpen(false), [box, list], floating)
  const floatStyle = useAnchoredStyle(open, box, floating)
  const wrap = (node: ReactNode) => (floating && portalHost() ? createPortal(node, portalHost()!) : node)
  const on = (id: string) => visible.includes(id)
  const toggle = (c: ColumnDef) => { if (c.locked) return; onChange(on(c.id) ? visible.filter(x => x !== c.id) : [...visible, c.id]) }
  const changed = columns.some(c => !c.locked && on(c.id) !== defaults.includes(c.id))
  const shown = columns.filter(c => c.locked || on(c.id)).length
  return (
    <div className="filterpop" ref={box}>
      <button type="button" className={'iconbtn' + (compact ? ' iconbtn--sm' : '') + (changed ? ' is-on' : '')} aria-haspopup="menu" aria-expanded={open} aria-label="Adjust columns" title="Adjust columns" onClick={() => setOpen(o => !o)}>
        <IconLayoutColumns size={compact ? 16 : 18} stroke={1.9} />
        {changed && <i className="iconbtn__dot" aria-hidden="true" />}
      </button>
      {open && (!floating || floatStyle) && wrap(
        <div ref={list} style={floatStyle} className="filterpop__list colpop" role="menu" aria-label="Columns">
          <p className="filterpop__title">Columns <span className="colpop__count">{shown} of {columns.length} shown</span></p>
          {columns.map(c => (
            <button key={c.id} type="button" role="menuitemcheckbox" aria-checked={c.locked || on(c.id)} aria-disabled={c.locked || undefined}
              className={'filterpop__item colpop__item' + (c.locked ? ' is-locked' : '')} onClick={() => toggle(c)}>
              <span className="colpop__box" aria-hidden="true">{(c.locked || on(c.id)) && <IconCheck size={14} stroke={3} />}</span>
              <span>{c.label}</span>
              {c.locked && <span className="colpop__lock">Always on</span>}
            </button>
          ))}
          {changed && <button type="button" className="filterpop__clear" onClick={() => onChange(defaults)}>Reset to default</button>}
        </div>
      )}
    </div>
  )
}
