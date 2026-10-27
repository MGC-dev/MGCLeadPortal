import { useState } from 'react'
import { agenda as api } from '../api'
import { useQuery } from '../hooks'
import { AGENDA_TYPES, ATTORNEYS, type AgendaItem } from '../types'
import { AgendaModal, AgendaRow } from '../components/contacts'
import { Button, Card, PageHeader, Select, Tabs } from '../components/ui'
import { dayDiff, dayLabel } from '../format'

type Tab = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all'

const rules: Record<Tab, (a: AgendaItem) => boolean> = {
  today: a => !a.done && dayDiff(a.dueAt) === 0,
  upcoming: a => !a.done && dayDiff(a.dueAt) > 0,
  overdue: a => !a.done && dayDiff(a.dueAt) < 0,
  completed: a => a.done,
  all: () => true,
}

export default function Agenda() {
  const items = useQuery(() => api.list())
  const [tab, setTab] = useState<Tab>('today')
  const [who, setWho] = useState('')
  const [type, setType] = useState('')
  const [adding, setAdding] = useState(false)

  const base = (items ?? []).filter(a => (!who || a.assignedTo === who) && (!type || a.type === type))
  const count = (t: Tab) => base.filter(rules[t]).length
  let rows = base.filter(rules[tab])
  if (tab === 'completed') rows = [...rows].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  // group by day
  const groups = new Map<string, AgendaItem[]>()
  rows.forEach(a => {
    const k = tab === 'completed' ? 'Completed' : dayLabel(a.dueAt)
    groups.set(k, [...(groups.get(k) ?? []), a])
  })

  const label = (t: Tab, name: string) => `${name}${count(t) ? ` (${count(t)})` : ''}`
  return (
    <>
      <PageHeader title="Agenda" subtitle="Every call, meeting, task and deadline in one place. Pipeline moves add the next step for you."
        actions={<>
          <Select value={who} onChange={e => setWho(e.target.value)} className="!w-44"><option value="">Everyone</option>{ATTORNEYS.map(a => <option key={a}>{a}</option>)}</Select>
          <Select value={type} onChange={e => setType(e.target.value)} className="!w-36"><option value="">All types</option>{Object.entries(AGENDA_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Button onClick={() => setAdding(true)}>+ Schedule</Button>
        </>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'today', label: label('today', 'Today') }, { key: 'upcoming', label: label('upcoming', 'Upcoming') },
        { key: 'overdue', label: label('overdue', 'Overdue') }, { key: 'completed', label: 'Completed' }, { key: 'all', label: 'All' },
      ]} />
      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">{tab === 'overdue' ? 'Nothing overdue. Nice work.' : tab === 'today' ? 'Nothing scheduled for today.' : 'Nothing here.'}</Card>
      ) : (
        <div className="space-y-4">
          {[...groups].map(([day, list]) => (
            <Card key={day} className="px-5 py-3">
              <h2 className={`mb-1 text-xs font-semibold uppercase tracking-wide ${tab === 'overdue' ? 'text-red-600' : 'text-slate-500'}`}>{day}</h2>
              {list.map(a => <AgendaRow key={a.id} item={a} />)}
            </Card>
          ))}
        </div>
      )}
      {adding && <AgendaModal onClose={() => setAdding(false)} />}
    </>
  )
}
