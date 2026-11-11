import { useState } from 'react'
import { IconArrowBackUp, IconCalendarEvent, IconChecklist, IconFlag, IconPhone, IconTrash, IconUsers, type Icon as TablerIcon } from '@tabler/icons-react'
import { tasksApi } from '../../api'
import { config } from '../../api/mockData'
import type { Lead, Task, TaskType } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Select } from '../../shared/Select'
import { Field, Sheet } from '../../shared/ui'
import { dayAt } from '../../shared/format'

export const TASK_TYPES: Record<TaskType, string> = { task: 'Task', call: 'Call', meeting: 'Meeting', follow_up: 'Follow-up', deadline: 'Deadline' }

/** One solid colour and icon per kind of task, shared by Tasks and Calendar. White on each is 4.6:1 or better. */
export const TASK_LOOK: Record<TaskType, { color: string; Icon: TablerIcon }> = {
  call: { color: '#1f4fd8', Icon: IconPhone },
  meeting: { color: '#6d28d9', Icon: IconUsers },
  follow_up: { color: '#0f766e', Icon: IconArrowBackUp },
  deadline: { color: '#b91c1c', Icon: IconFlag },
  task: { color: '#475569', Icon: IconChecklist },
}

/** The task's kind as a solid tile, like the document tiles. */
export function TaskTile({ type, size = 38 }: { type: TaskType; size?: number }) {
  const { color, Icon } = TASK_LOOK[type]
  return (
    <span className="ltable__avatar tasktile" aria-hidden="true" style={{ background: color, width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} stroke={2} />
    </span>
  )
}

const toInput = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/**
 * Schedule a new task, or open an existing one to change it, tick it off or delete it.
 * `at` sets the time for a new task (for example the slot clicked in the calendar).
 */
export function TaskSheet({ task, leads, at, onClose }: { task?: Task; leads: Lead[]; at?: number; onClose: () => void }) {
  const { openLead } = useUi()
  const [type, setType] = useState<string>(task?.type ?? 'call')
  const [who, setWho] = useState<string>(task?.assignedTo ?? config.owners[0])
  const [lead, setLead] = useState<string>(task?.leadId ?? '')
  const [confirming, setConfirming] = useState(false)
  const linked = leads.find(l => l.id === lead)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!d.title.trim()) return
    const data = { type: d.type as TaskType, title: d.title.trim(), dueAt: +new Date(d.when), assignedTo: d.who, leadId: d.lead || undefined, notes: d.notes || undefined }
    if (task) await tasksApi.update(task.id, data)
    else await tasksApi.create(data)
    onClose()
  }

  const foot = (
    <div className="sheet__foot taskfoot">
      {task && (confirming ? (
        <span className="taskfoot__confirm">
          <span>Delete this task?</span>
          <button type="button" className="btn btn--sm" onClick={() => setConfirming(false)}>Keep</button>
          <button type="button" className="btn btn--sm btn--destructive" onClick={async () => { await tasksApi.remove(task.id); onClose() }}>Delete</button>
        </span>
      ) : (
        <button type="button" className="btn btn--plain taskfoot__delete" onClick={() => setConfirming(true)}><IconTrash size={16} stroke={1.9} />Delete</button>
      ))}
      <span className="taskfoot__spacer" />
      {task && <button type="button" className="btn" onClick={async () => { await tasksApi.toggle(task.id); onClose() }}>{task.done ? 'Mark as not done' : 'Mark as done'}</button>}
      <button type="submit" className="btn btn--prominent">{task ? 'Save changes' : 'Schedule'}</button>
    </div>
  )

  return (
    <Sheet title={task ? 'Task' : 'Schedule a task'} info="A call, meeting, follow-up, deadline or to-do, on someone’s task list and in the calendar."
      icon={<TaskTile type={type as TaskType} size={36} />} onClose={onClose} onSubmit={submit} foot={foot}>
      <div className="formgroup">
        <Field label="Title" id="tk-t"><input id="tk-t" name="title" required autoFocus={!task} autoComplete="off" defaultValue={task?.title} placeholder="Call Rachel about her documents" /></Field>
        <Field label="Type" id="tk-ty" stack><Select contain id="tk-ty" name="type" value={type} onChange={setType} options={Object.entries(TASK_TYPES).map(([k, v]) => ({ value: k, label: v }))} /></Field>
        <Field label="When" id="tk-w"><input id="tk-w" name="when" type="datetime-local" required defaultValue={toInput(task?.dueAt ?? at ?? dayAt(1, 10))} /></Field>
        <Field label="Assigned To" id="tk-a" stack><Select contain id="tk-a" name="who" value={who} onChange={setWho} options={config.owners.map(o => ({ value: o, label: o }))} /></Field>
        <Field label="Lead" id="tk-l" stack><Select contain id="tk-l" name="lead" value={lead} onChange={setLead} options={[{ value: '', label: 'None' }, ...leads.map(l => ({ value: l.id, label: l.name }))]} /></Field>
      </div>
      <div className="formgroup"><Field label="Notes" id="tk-n" stack><textarea id="tk-n" name="notes" defaultValue={task?.notes} /></Field></div>
      {linked && <button type="button" className="btn btn--plain taskopenlead" onClick={() => { onClose(); openLead(linked.id) }}><IconCalendarEvent size={16} stroke={1.9} />Open {linked.name}’s ticket</button>}
    </Sheet>
  )
}
