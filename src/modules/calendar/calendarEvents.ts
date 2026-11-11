import type { Task, FirmEvent, Lead, TaskType } from '../../api/types'

export interface CalEvent {
  t: number; dur: number; title: string; who: string
  /** The lead the task is for, if any. */
  id?: string
  /** The task behind this block (firm events have none). */
  taskId?: string
  type?: TaskType
  /** Who it is assigned to. */
  owner?: string
  firm?: boolean; done?: boolean; late?: boolean
}

/** Tasks (with their lead) and the firm's own events, as calendar blocks. */
export function calEvents(tasks: Task[], leads: Lead[], events: FirmEvent[]): CalEvent[] {
  const now = Date.now()
  const fromTasks: CalEvent[] = tasks.map(a => {
    const l = leads.find(x => x.id === a.leadId)
    return { t: a.dueAt, dur: a.type === 'meeting' ? 60 : 30, title: a.title, who: l?.name ?? a.assignedTo, id: l?.id, taskId: a.id, type: a.type, owner: a.assignedTo, firm: !l, done: a.done, late: !a.done && a.dueAt < now }
  })
  return fromTasks.concat(events.map(e => ({ t: e.t, dur: e.dur, title: e.title, who: e.who, firm: true, done: false, late: false })))
}
