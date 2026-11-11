import type { Task, FirmEvent, Lead } from '../../api/types'

export interface CalEvent { t: number; dur: number; title: string; who: string; id?: string; firm?: boolean; done?: boolean; late?: boolean }

/** Tasks (with their lead) and the firm's own events, as calendar blocks. */
export function calEvents(tasks: Task[], leads: Lead[], events: FirmEvent[]): CalEvent[] {
  const now = Date.now()
  const fromTasks = tasks.map(a => {
    const l = leads.find(x => x.id === a.leadId)
    return { t: a.dueAt, dur: a.type === 'meeting' ? 60 : 30, title: a.title, who: l?.name ?? a.assignedTo, id: l?.id, firm: !l, done: a.done, late: !a.done && a.dueAt < now }
  })
  return fromTasks.concat(events.map(e => ({ t: e.t, dur: e.dur, title: e.title, who: e.who, id: undefined, firm: true, done: false, late: false })))
}
