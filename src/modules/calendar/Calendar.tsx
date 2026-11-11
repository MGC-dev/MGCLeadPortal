import { useMemo } from 'react'
import { IconCheck, IconExternalLink } from '@tabler/icons-react'
import { tasksApi, eventsApi, leadsApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { TaskType } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { TASK_TYPES } from '../tasks/TaskSheet'
import { calEvents } from './calendarEvents'
import { EventManager, type CalendarView, type Event, type EventColor } from '@/components/ui/event-manager'
import { Button } from '@/components/ui/button'

const FIRM = 'Firm event'
/** One solid colour per kind of task (the same as Tasks), written out in full so Tailwind generates them. */
const COLORS: EventColor[] = [
  { name: 'Call', value: 'call', bg: 'bg-[#1f4fd8]', text: 'text-[#1f4fd8]' },
  { name: 'Meeting', value: 'meeting', bg: 'bg-[#6d28d9]', text: 'text-[#6d28d9]' },
  { name: 'Follow-up', value: 'follow_up', bg: 'bg-[#0f766e]', text: 'text-[#0f766e]' },
  { name: 'Deadline', value: 'deadline', bg: 'bg-[#b91c1c]', text: 'text-[#b91c1c]' },
  { name: 'Task', value: 'task', bg: 'bg-[#475569]', text: 'text-[#475569]' },
  { name: FIRM, value: 'firm', bg: 'bg-[#8f6e2c]', text: 'text-[#8f6e2c]' },
]
const typeOfLabel = (label?: string) => (Object.entries(TASK_TYPES).find(([, v]) => v === label)?.[0] ?? 'task') as TaskType

/** Calls, meetings, follow-ups and deadlines from Tasks, with the firm's own events, by month, week, day or as a list. */
export default function Calendar() {
  const tasks = useQuery(() => tasksApi.list())
  const leads = useQuery(() => leadsApi.list())
  const firm = useQuery(() => eventsApi.list())
  const { filter, setFilter, openLead } = useUi()

  const events = useMemo<Event[]>(() => {
    if (!tasks || !leads || !firm) return []
    return calEvents(tasks, leads, firm).map((x, i) => {
      const task = x.taskId ? tasks.find(t => t.id === x.taskId) : undefined
      return {
        id: x.taskId ?? `firm:${i}:${x.t}`,
        title: x.title,
        description: task ? task.notes : x.who,
        startTime: new Date(x.t),
        endTime: new Date(x.t + x.dur * 60_000),
        color: x.type ?? 'firm',
        category: x.type ? TASK_TYPES[x.type] : FIRM,
        tags: x.owner ? [x.owner] : [],
        readOnly: !x.taskId,
        done: x.done,
      }
    })
  }, [tasks, leads, firm])

  if (!tasks || !leads || !firm) return null

  return (
    <div className="ai-surface apple-type calx calx--em">
      <EventManager
        className="h-full"
        events={events}
        defaultView={(filter.calmode as CalendarView) ?? 'week'}
        onViewChange={v => setFilter('calmode', v)}
        categories={(['call', 'meeting', 'follow_up', 'deadline', 'task'] as TaskType[]).map(k => TASK_TYPES[k])}
        colors={COLORS}
        colorFromCategory={c => COLORS.find(x => x.name === c)?.value}
        availableTags={config.owners}
        singleTag
        labels={{ newEvent: 'Schedule', category: 'Type', tags: 'Assigned to' }}
        onEventCreate={e => tasksApi.create({
          type: typeOfLabel(e.category), title: e.title, dueAt: +e.startTime,
          assignedTo: e.tags?.[0] ?? config.owners[0], notes: e.description || undefined,
        })}
        onEventUpdate={(id, e) => {
          if (id.startsWith('firm:')) return
          tasksApi.update(id, {
            ...(e.title !== undefined && { title: e.title }),
            ...(e.startTime && { dueAt: +e.startTime }),
            ...(e.category && { type: typeOfLabel(e.category) }),
            ...(e.tags?.[0] && { assignedTo: e.tags[0] }),
            ...(e.description !== undefined && { notes: e.description || undefined }),
          })
        }}
        onEventDelete={id => { if (!id.startsWith('firm:')) tasksApi.remove(id) }}
        dialogActions={(e, close) => {
          const t = tasks.find(x => x.id === e.id)
          if (!t) return null
          const lead = t.leadId ? leads.find(l => l.id === t.leadId) : undefined
          return (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => { await tasksApi.toggle(t.id); close() }}>
                <IconCheck className="h-4 w-4" />{t.done ? 'Not done' : 'Done'}
              </Button>
              {lead && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { close(); openLead(lead.id) }}>
                  <IconExternalLink className="h-4 w-4" />{lead.name.split(' ')[0]}’s ticket
                </Button>
              )}
            </>
          )
        }}
      />
    </div>
  )
}
