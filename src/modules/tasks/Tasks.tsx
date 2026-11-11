import { useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { tasksApi, leadsApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Task, Lead } from '../../api/types'
import { type Col, DataTable, SortMenu, sortRows, useTableView } from '../../shared/DataTable'
import { HeaderActions } from '../../shared/HeaderActions'
import { ExpandingSearch, FilterMenu } from '../../shared/HeaderTools'
import { Icon } from '../../shared/Icon'
import { Empty, Seg, Tag } from '../../shared/ui'
import { dayAt, endOfToday, initials, timeOf } from '../../shared/format'
import { TASK_TYPES, TaskSheet, TaskTile } from './TaskSheet'

export { TASK_TYPES }
type Tab = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all'
const STORE = 'unir-tasks-columns-v1'

const startToday = () => dayAt(0)
const rules: Record<Tab, (a: Task) => boolean> = {
  today: a => !a.done && a.dueAt >= startToday() && a.dueAt <= endOfToday(),
  upcoming: a => !a.done && a.dueAt > endOfToday(),
  overdue: a => !a.done && a.dueAt < startToday(),
  completed: a => a.done,
  all: () => true,
}

/** "Today", "Tomorrow", "Yesterday", then "Mon, Nov 16". */
export function dayLabel(t: number) {
  const d = new Date(t), today = new Date()
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function StatusTag({ a }: { a: Task }) {
  if (a.done) return <Tag tone="green" icon="check">Done</Tag>
  if (a.dueAt < Date.now()) return <Tag tone="red">Overdue</Tag>
  if (a.dueAt <= endOfToday()) return <Tag tone="accent">Due today</Tag>
  return <Tag tone="tint">Upcoming</Tag>
}

/** The round tick at the start of a row. Ticking it does not open the task. */
function Check({ a }: { a: Task }) {
  return (
    <button className="check" type="button" role="checkbox" aria-checked={a.done} aria-label={`Done: ${a.title}`}
      onClick={e => { e.stopPropagation(); void tasksApi.toggle(a.id) }} onKeyDown={e => e.stopPropagation()}><Icon name="check" /></button>
  )
}

/** Every call, meeting, task and deadline in one place. Pipeline moves book their next step here automatically. */
export default function Tasks() {
  const items = useQuery(() => tasksApi.list())
  const leads = useQuery(() => leadsApi.list()) ?? []
  const [tab, setTab] = useState<Tab>('today')
  const [who, setWho] = useState('all')
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Task | 'new' | null>(null)
  const leadOf = (a: Task): Lead | undefined => leads.find(l => l.id === a.leadId)

  const cols = useMemo<Col<Task>[]>(() => [
    { id: 'task', label: 'Task', locked: true, sort: a => a.title.toLowerCase(), render: a => {
      const l = leadOf(a)
      return (
        <span className={'ltable__who taskrow' + (a.done ? ' is-done' : '')}>
          <Check a={a} />
          <TaskTile type={a.type} />
          <span><b>{a.title}</b><small>{l ? `${l.name} · ${l.matter}` : 'Firm task'}</small></span>
        </span>
      )
    } },
    { id: 'due', label: 'Due', defaultOn: true, sort: a => a.dueAt, render: a => (
      <span className="ltable__text taskdue"><b className={!a.done && a.dueAt < Date.now() ? 'is-late' : ''}>{dayLabel(a.dueAt)}</b><small>{timeOf(a.dueAt)}</small></span>) },
    { id: 'status', label: 'Status', defaultOn: true, sort: a => (a.done ? 3 : a.dueAt < Date.now() ? 0 : a.dueAt <= endOfToday() ? 1 : 2), render: a => <StatusTag a={a} /> },
    { id: 'type', label: 'Type', defaultOn: true, sort: a => TASK_TYPES[a.type], render: a => <span className="ltable__text">{TASK_TYPES[a.type]}</span> },
    { id: 'owner', label: 'Assigned To', defaultOn: true, sort: a => a.assignedTo.toLowerCase(), render: a => <span className="ltable__owner"><i aria-hidden="true">{initials(a.assignedTo)}</i>{a.assignedTo.split(' ')[0]}</span> },
    { id: 'notes', label: 'Notes', sort: a => a.notes ?? '', render: a => <span className="ltable__text tasknotes">{a.notes || '—'}</span> },
  ], [leads]) // eslint-disable-line react-hooks/exhaustive-deps
  const view = useTableView<Task>(STORE, cols, { key: 'due', dir: 'asc' })

  if (!items) return null
  const term = q.trim().toLowerCase()
  const base = items.filter(a => (who === 'all' || a.assignedTo === who) && (type === 'all' || a.type === type) &&
    (!term || `${a.title} ${leadOf(a)?.name ?? ''} ${leadOf(a)?.matter ?? ''} ${a.notes ?? ''}`.toLowerCase().includes(term)))
  const count = (t: Tab) => base.filter(rules[t]).length
  const tie = tab === 'completed' ? (a: Task, b: Task) => (b.completedAt ?? 0) - (a.completedAt ?? 0) : (a: Task, b: Task) => a.dueAt - b.dueAt
  const rows = sortRows(base.filter(rules[tab]), view, tie)
  const label = (t: Tab, n: string) => `${n}${count(t) ? ` ${count(t)}` : ''}`

  return (
    <>
      <HeaderActions>
        <button type="button" className="iconbtn iconbtn--primary" aria-label="Schedule a task" title="Schedule a task" onClick={() => setOpen('new')}><IconPlus size={19} stroke={2.2} /></button>
        <ExpandingSearch value={q} onChange={setQ} />
        <span className="only-phone-inline"><SortMenu view={view} label="Sort tasks" /></span>
        <FilterMenu label="Filter tasks" activeLabel="Filters applied" sections={[
          { title: 'Assigned to', value: who, onChange: setWho, options: [{ value: 'all', label: 'Everyone', badge: null }, ...config.owners.map(o => ({ value: o, label: o, badge: null }))] },
          { title: 'Type', value: type, onChange: setType, options: [{ value: 'all', label: 'All types', badge: null }, ...Object.entries(TASK_TYPES).map(([k, v]) => ({ value: k, label: v, badge: null }))] },
        ]} />
      </HeaderActions>

      <div className="tasktabs">
        <Seg<Tab> value={tab} onChange={setTab} label="Show tasks"
          options={[['today', label('today', 'Today')], ['upcoming', label('upcoming', 'Upcoming')], ['overdue', label('overdue', 'Overdue')], ['completed', 'Completed'], ['all', 'All']]} />
      </div>

      {rows.length === 0
        ? <Empty icon="tasks">{term ? 'No tasks match your search.' : tab === 'overdue' ? 'Nothing overdue. Nice work.' : tab === 'today' ? 'Nothing scheduled for today.' : 'Nothing here.'}</Empty>
        : (
          <>
            <DataTable rows={rows} view={view} rowKey={a => a.id} onOpen={a => setOpen(a)} sortLabel="Sort tasks" />
            <ul className="lcards only-phone">{rows.map(a => {
              const l = leadOf(a)
              return (
                <li key={a.id}>
                  <div className={'lcard taskcard' + (a.done ? ' is-done' : '')} role="button" tabIndex={0} onClick={() => setOpen(a)} onKeyDown={e => { if (e.key === 'Enter') setOpen(a) }}>
                    <span className="lcard__top"><Check a={a} /><TaskTile type={a.type} size={34} />
                      <span className="lcard__who"><b>{a.title}</b><small>{l ? l.name : 'Firm task'} · {dayLabel(a.dueAt)} {timeOf(a.dueAt)}</small></span></span>
                    <span className="lcard__meta"><StatusTag a={a} /><span className="caption">{a.assignedTo}</span></span>
                  </div>
                </li>
              )
            })}</ul>
          </>
        )}
      {open && <TaskSheet task={open === 'new' ? undefined : items.find(x => x.id === open.id)} leads={leads} onClose={() => setOpen(null)} />}
    </>
  )
}
