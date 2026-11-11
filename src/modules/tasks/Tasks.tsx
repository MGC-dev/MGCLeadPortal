import { useState } from 'react'
import { tasksApi, leadsApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Task, TaskType, Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Select } from '../../shared/Select'
import { Empty, Field, Seg, Sheet, SheetFoot, Tag } from '../../shared/ui'
import { dayAt, endOfToday, timeOf } from '../../shared/format'

export const TASK_TYPES: Record<TaskType, string> = { task: 'Task', call: 'Call', meeting: 'Meeting', follow_up: 'Follow-up', deadline: 'Deadline' }
type Tab = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all'

const startToday = () => dayAt(0)
const rules: Record<Tab, (a: Task) => boolean> = {
  today: a => !a.done && a.dueAt >= startToday() && a.dueAt <= endOfToday(),
  upcoming: a => !a.done && a.dueAt > endOfToday(),
  overdue: a => !a.done && a.dueAt < startToday(),
  completed: a => a.done,
  all: () => true,
}

function dayLabel(t: number) {
  const d = new Date(t), today = new Date()
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function DueTag({ a }: { a: Task }) {
  if (a.done) return <Tag tone="green" icon="check">Done</Tag>
  if (a.dueAt < Date.now()) return <Tag tone="red">Overdue</Tag>
  return <Tag tone={a.dueAt <= endOfToday() ? 'accent' : undefined}>{timeOf(a.dueAt)}</Tag>
}

function Row({ a, lead }: { a: Task; lead?: Lead }) {
  const { openLead } = useUi()
  return (
    <li>
      <div className={'row task' + (a.done ? ' is-done' : '')}>
        <button className="check" type="button" role="checkbox" aria-checked={a.done} aria-label={`Done: ${a.title}`} onClick={() => tasksApi.toggle(a.id)}><Icon name="check" /></button>
        <button className="task__open" type="button" onClick={() => lead && openLead(lead.id)} style={lead ? undefined : { cursor: 'default' }}>
          <span className="row__main"><b>{a.title}</b><span>{lead ? `${lead.name} · ${lead.matter}` : 'Firm'} · {TASK_TYPES[a.type]}</span></span>
          <span className="row__end"><DueTag a={a} /><span className="caption">{a.assignedTo}</span></span>
        </button>
        <button className="btn btn--plain btn--sm" type="button" aria-label={`Delete ${a.title}`} onClick={() => tasksApi.remove(a.id)}><Icon name="x" small /></button>
      </div>
    </li>
  )
}

function ScheduleModal({ leads, onClose }: { leads: Lead[]; onClose: () => void }) {
  const [ty, setTy] = useState('call')
  const [asg, setAsg] = useState<string>(config.owners[0])
  const [ld, setLd] = useState('')
  const toInput = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  return (
    <Sheet title="Schedule" info="Add a call, meeting, task or deadline to your tasks." onClose={onClose} foot={<SheetFoot onCancel={onClose} primary="Schedule" />}
      onSubmit={async e => {
        e.preventDefault()
        const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
        if (!d.title.trim()) return
        await tasksApi.create({ type: d.type as TaskType, title: d.title.trim(), dueAt: +new Date(d.when), assignedTo: d.who, leadId: d.lead || undefined, notes: d.notes || undefined })
        onClose()
      }}>
      <div className="formgroup">
        <Field label="Title" id="ag-t"><input id="ag-t" name="title" required autoFocus autoComplete="off" placeholder="Call Rachel about her documents" /></Field>
        <Field label="Type" id="ag-ty" stack><Select contain id="ag-ty" name="type" value={ty} onChange={setTy} options={Object.entries(TASK_TYPES).map(([k, v]) => ({ value: k, label: v }))} /></Field>
        <Field label="When" id="ag-w"><input id="ag-w" name="when" type="datetime-local" required defaultValue={toInput(dayAt(1, 10))} /></Field>
        <Field label="Assigned To" id="ag-a" stack><Select contain id="ag-a" name="who" value={asg} onChange={setAsg} options={config.owners.map(o => ({ value: o, label: o }))} /></Field>
        <Field label="Lead" id="ag-l" stack><Select contain id="ag-l" name="lead" value={ld} onChange={setLd} options={[{ value: '', label: 'None' }, ...leads.map(l => ({ value: l.id, label: l.name }))]} /></Field>
      </div>
      <div className="formgroup"><Field label="Notes" id="ag-n" stack><textarea id="ag-n" name="notes" /></Field></div>
    </Sheet>
  )
}

/** Every call, meeting, task and deadline in one place. Pipeline moves book their next step here automatically. */
export default function Tasks() {
  const items = useQuery(() => tasksApi.list())
  const leads = useQuery(() => leadsApi.list()) ?? []
  const [tab, setTab] = useState<Tab>('today')
  const [who, setWho] = useState('')
  const [type, setType] = useState('')
  const [adding, setAdding] = useState(false)
  if (!items) return null

  const base = items.filter(a => (!who || a.assignedTo === who) && (!type || a.type === type))
  const count = (t: Tab) => base.filter(rules[t]).length
  let rows = base.filter(rules[tab])
  if (tab === 'completed') rows = [...rows].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const groups = new Map<string, Task[]>()
  rows.forEach(a => { const k = tab === 'completed' ? 'Completed' : dayLabel(a.dueAt); groups.set(k, [...(groups.get(k) ?? []), a]) })
  const label = (t: Tab, n: string) => `${n}${count(t) ? ` (${count(t)})` : ''}`

  return (
    <>
      <div className="boardbar">
        <Seg<Tab> value={tab} onChange={setTab} options={[['today', label('today', 'Today')], ['upcoming', label('upcoming', 'Upcoming')], ['overdue', label('overdue', 'Overdue')], ['completed', 'Completed'], ['all', 'All']]} label="Tasks view" />
        <div className="boardbar__select"><Select aria-label="Assigned to" value={who} onChange={setWho} options={[{ value: '', label: 'Everyone' }, ...config.owners.map(o => ({ value: o, label: o }))]} /></div>
        <div className="boardbar__select"><Select aria-label="Type" value={type} onChange={setType} options={[{ value: '', label: 'All types' }, ...Object.entries(TASK_TYPES).map(([k, v]) => ({ value: k, label: v }))]} /></div>
        <button className="btn btn--prominent" type="button" onClick={() => setAdding(true)} style={{ marginLeft: 'auto' }}><Icon name="plus" small />Schedule</button>
      </div>
      {rows.length === 0
        ? <Empty icon="tasks">{tab === 'overdue' ? 'Nothing overdue. Nice work.' : tab === 'today' ? 'Nothing scheduled for today.' : 'Nothing here.'}</Empty>
        : [...groups].map(([day, list]) => (
          <div key={day}>
            <p className="section-title">{day} ({list.length})</p>
            <ul className="group rows">{list.map(a => <Row key={a.id} a={a} lead={leads.find(l => l.id === a.leadId)} />)}</ul>
          </div>
        ))}
      {adding && <ScheduleModal leads={leads} onClose={() => setAdding(false)} />}
    </>
  )
}
