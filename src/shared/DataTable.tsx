import { useState, type ReactNode } from 'react'
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import { ColumnsMenu, FilterMenu } from './HeaderTools'

export type Dir = 'asc' | 'desc'
export interface Sort { key: string; dir: Dir }

export interface Col<T> {
  id: string
  label: string
  /** Always shown; cannot be switched off in the columns menu. */
  locked?: boolean
  /** Shown by default (optional columns are off until ticked). */
  defaultOn?: boolean
  render: (row: T) => ReactNode
  /** Value used when sorting by this column. */
  sort: (row: T) => string | number
  /** Direction on the first click of the header (numbers and dates read best biggest/newest first). */
  firstDir?: Dir
  /** Extra class for the body cells. */
  className?: string
}

export interface TableView<T> {
  cols: Col<T>[]
  shown: Col<T>[]
  visible: string[]
  defaults: string[]
  setVisible: (ids: string[]) => void
  sort: Sort
  setSort: React.Dispatch<React.SetStateAction<Sort>>
  defaultSort: Sort
  clickSort: (key: string) => void
}

/** Column choice (remembered in the browser) and sort order for one table. */
export function useTableView<T>(storageKey: string, cols: Col<T>[], defaultSort: Sort): TableView<T> {
  const defaults = cols.filter(c => !c.locked && c.defaultOn).map(c => c.id)
  const [visible, setVisibleState] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (Array.isArray(raw)) return raw.filter((id: unknown) => typeof id === 'string' && cols.some(c => c.id === id))
    } catch { /* storage blocked or corrupt */ }
    return defaults
  })
  const [sort, setSort] = useState<Sort>(defaultSort)
  const setVisible = (ids: string[]) => {
    setVisibleState(ids)
    try { localStorage.setItem(storageKey, JSON.stringify(ids)) } catch { /* ignore */ }
  }
  const clickSort = (key: string) => setSort(s => s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: cols.find(c => c.id === key)?.firstDir ?? 'asc' })
  return { cols, shown: cols.filter(c => c.locked || visible.includes(c.id)), visible, defaults, setVisible, sort, setSort, defaultSort, clickSort }
}

/** Returns the rows ordered by the current sort (ties keep the order given by `tie`). */
export function sortRows<T>(rows: T[], view: TableView<T>, tie: (a: T, b: T) => number = () => 0): T[] {
  const col = view.cols.find(c => c.id === view.sort.key) ?? view.cols[0]
  const dir = view.sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = col.sort(a), y = col.sort(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir || tie(a, b)
  })
}

/** Sort icon with a menu: choose the column and the order. */
export function SortMenu<T>({ view, label, floating = false, compact = false }: { view: TableView<T>; label: string; floating?: boolean; compact?: boolean }) {
  const first = view.cols.find(c => c.id === view.defaultSort.key) ?? view.cols[0]
  return (
    <FilterMenu icon="sort" label={label} activeLabel="Sorted" resetLabel="Reset sort" floating={floating} compact={compact} sections={[
      { title: 'Sort by', value: view.sort.key, onChange: key => view.setSort(s => ({ ...s, key })),
        options: [first, ...view.cols.filter(c => c.id !== first.id)].map(c => ({ value: c.id, label: c.label, badge: null })) },
      { title: 'Order', value: view.sort.dir, onChange: d => view.setSort(s => ({ ...s, dir: d as Dir })),
        options: view.defaultSort.dir === 'desc'
          ? [{ value: 'desc', label: 'Descending', badge: null }, { value: 'asc', label: 'Ascending', badge: null }]
          : [{ value: 'asc', label: 'Ascending', badge: null }, { value: 'desc', label: 'Descending', badge: null }] },
    ]} />
  )
}

/**
 * The portal's table: toned header with sortable columns, a sort and a columns icon at the end of the header,
 * and rows that open on click or Enter. Squeezes to fit when many columns are shown.
 */
export function DataTable<T>({ rows, view, rowKey, onOpen, sortLabel }: { rows: T[]; view: TableView<T>; rowKey: (row: T) => string; onOpen: (row: T) => void; sortLabel: string }) {
  const { shown, sort, clickSort } = view
  return (
    <div className="ltable only-desk">
      <table className={shown.length > 6 ? 'is-dense' : undefined} style={{ minWidth: shown.length * 100 + 56 }}>
        <thead>
          <tr>
            {shown.map(c => {
              const on = sort.key === c.id
              return (
                <th key={c.id} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className={'ltable__sort' + (on ? ' is-on' : '')} onClick={() => clickSort(c.id)} title={`Sort by ${c.label}`}>
                    {c.label}{on && (sort.dir === 'asc' ? <IconArrowUp size={13} stroke={2.6} /> : <IconArrowDown size={13} stroke={2.6} />)}
                  </button>
                </th>
              )
            })}
            <th className="ltable__tools">
              <span className="ltable__tools-in">
                <SortMenu view={view} label={sortLabel} floating compact />
                <ColumnsMenu floating compact columns={view.cols} visible={view.visible} defaults={view.defaults} onChange={view.setVisible} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} onClick={() => onOpen(r)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpen(r) }}>
              {shown.map(c => <td key={c.id} className={c.className}>{c.render(r)}</td>)}
              <td className="ltable__tools" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
