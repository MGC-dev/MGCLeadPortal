import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react'
import { tasksApi, eventsApi, leadsApi, useQuery } from '../../api'
import { DAY, config } from '../../api/mockData'
import type { Task } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { HeaderActions } from '../../shared/HeaderActions'
import { FilterMenu } from '../../shared/HeaderTools'
import { Seg } from '../../shared/ui'
import { dayAt, timeOf } from '../../shared/format'
import { TASK_LOOK, TASK_TYPES, TaskSheet } from '../tasks/TaskSheet'
import { calEvents, type CalEvent } from './calendarEvents'

type Mode = 'day' | 'week' | 'month'
/** Height of one hour in the day and week views. The whole day scrolls; it opens at 7 AM (or just before now). */
const ROW = 52
const FIRM = '#8f6e2c'
const hh = (h: number) => (h === 0 ? '12 AM' : h === 12 ? 'Noon' : `${h % 12} ${h < 12 ? 'AM' : 'PM'}`)
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', o)
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
/** Colour says what kind of item it is; being overdue is said in words, so red keeps meaning Deadline. */
const colorOf = (x: CalEvent) => (x.type ? TASK_LOOK[x.type].color : FIRM)
/** Soft fill, a solid bar on the left and text in the event's colour: readable at a glance, 4.5:1 or better. */
const evtStyle = (x: CalEvent): CSSProperties => ({ ['--c' as string]: x.done ? '#8e8e93' : colorOf(x) })

/** Lays out overlapping events side by side. */
function lanesFor(list: CalEvent[]) {
  const lanes: number[] = []
  const placed = list.map(x => {
    const end = x.t + Math.max(x.dur, 25) * 60e3
    let lane = lanes.findIndex(l => l <= x.t)
    if (lane < 0) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = end
    return { x, end, lane }
  })
  return placed.map(p => ({ ...p, lanes: Math.max(...placed.filter(y => y.x.t < p.end && y.end > p.x.t).map(y => y.lane)) + 1 }))
}

/** Calls, meetings, follow-ups and deadlines from Tasks, with the firm's own events, by day, week or month. */
export default function Calendar() {
  const tasks = useQuery(() => tasksApi.list())
  const leads = useQuery(() => leadsApi.list())
  const events = useQuery(() => eventsApi.list())
  const { filter, setFilter, openLead } = useUi()
  const [calAt, setCalAt] = useState(() => dayAt(0))
  const [show, setShow] = useState('all')
  const [owner, setOwner] = useState('all')
  const [sheet, setSheet] = useState<{ task?: Task; at?: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const body = useRef<HTMLDivElement>(null)
  const mode = filter.calmode as Mode

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])
  // Open the day at 7 AM, or two hours before now during working hours when today is on screen.
  useLayoutEffect(() => {
    const el = body.current; if (!el) return
    const hour = new Date().getHours(), h = hour >= 9 && hour <= 17 && Math.abs(calAt - dayAt(0)) < 7 * DAY ? hour - 2 : 7
    el.scrollTop = Math.min(h, 24) * ROW - 8
  }, [mode, calAt, !!tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!tasks || !leads || !events) return null

  // The span on screen.
  const anchor = new Date(calAt)
  let start = new Date(anchor), days: Date[] = []
  if (mode === 'month') {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  } else {
    if (mode === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    start.setHours(0, 0, 0, 0)
    days = Array.from({ length: mode === 'week' ? 7 : 1 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  const last = days[days.length - 1], today = new Date(now)
  const title = mode === 'month' ? fmt(anchor, { month: 'long', year: 'numeric' })
    : mode === 'day' ? fmt(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : start.getMonth() === last.getMonth() ? `${fmt(start, { month: 'long' })} ${start.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
        : `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(last, { month: 'short', day: 'numeric' })}, ${last.getFullYear()}`
  const shift = (dir: number) => {
    const d = new Date(calAt)
    if (mode === 'month') d.setMonth(d.getMonth() + dir, 1)
    else d.setDate(d.getDate() + dir * (mode === 'week' ? 7 : 1))
    setCalAt(+d)
  }
  const goDay = (d: Date) => { setCalAt(+d); setFilter('calmode', 'day') }

  const all = calEvents(tasks, leads, events).filter(x =>
    (show === 'all' || (show === 'tasks' ? !!x.taskId : !x.taskId)) && (owner === 'all' || x.owner === owner))
  const on = (d: Date) => { const s = +new Date(d.getFullYear(), d.getMonth(), d.getDate()); return all.filter(x => x.t >= s && x.t < s + DAY).sort((a, b) => a.t - b.t) }
  const open = (x: CalEvent) => { const t = x.taskId && tasks.find(a => a.id === x.taskId); if (t) setSheet({ task: t }); else if (x.id) openLead(x.id) }
  const label = (x: CalEvent) => `${x.title}, ${fmt(new Date(x.t), { weekday: 'long' })} ${timeOf(x.t)}${x.who ? `, ${x.who}` : ''}${x.late ? ', overdue' : ''}${x.done ? ', done' : ''}`

  /** A click on empty space in a day books a task at that half hour. */
  const slotClick = (d: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const y = e.nativeEvent.offsetY, mins = Math.round((y / ROW) * 2) * 30
    setSheet({ at: +new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, Math.min(mins, 23 * 60 + 30)) })
  }

  const legend = [...new Set(all.map(x => (x.taskId ? x.type! : 'firm')))]
  return (
    <>
      <HeaderActions>
        <button type="button" className="iconbtn iconbtn--primary" aria-label="Schedule a task" title="Schedule a task" onClick={() => setSheet({ at: Math.max(dayAt(0, new Date().getHours() + 1), +start + 10 * 3600e3) })}><IconPlus size={19} stroke={2.2} /></button>
        <FilterMenu label="Filter calendar" activeLabel="Filters applied" sections={[
          { title: 'Show', value: show, onChange: setShow, options: [{ value: 'all', label: 'Everything', badge: null }, { value: 'tasks', label: 'Tasks only', badge: null }, { value: 'firm', label: 'Firm events only', badge: null }] },
          { title: 'Assigned to', value: owner, onChange: setOwner, options: [{ value: 'all', label: 'Everyone', badge: null }, ...config.owners.map(o => ({ value: o, label: o, badge: null }))] },
        ]} />
      </HeaderActions>

      <section className={'calx calx--' + mode} aria-label="Calendar">
        <div className="calx__bar">
          <button className="btn btn--sm" type="button" onClick={() => setCalAt(dayAt(0))}>Today</button>
          <span className="calx__nav">
            <button className="iconbtn iconbtn--sm" type="button" onClick={() => shift(-1)} aria-label={`Previous ${mode}`}><IconChevronLeft size={18} stroke={2.2} /></button>
            <button className="iconbtn iconbtn--sm" type="button" onClick={() => shift(1)} aria-label={`Next ${mode}`}><IconChevronRight size={18} stroke={2.2} /></button>
          </span>
          <h2 aria-live="polite">{title}</h2>
          <span className="calx__legend" aria-label="Colour key">
            {legend.map(k => <span key={k}><i style={{ background: k === 'firm' ? FIRM : TASK_LOOK[k as keyof typeof TASK_LOOK].color }} />{k === 'firm' ? 'Firm event' : TASK_TYPES[k as keyof typeof TASK_TYPES]}</span>)}
          </span>
          <Seg<Mode> value={mode} onChange={m => setFilter('calmode', m)} label="Calendar view" options={[['day', 'Day'], ['week', 'Week'], ['month', 'Month']]} />
        </div>

        {mode === 'month' ? (
          <div className="calx__month">
            <div className="calx__dow">{days.slice(0, 7).map(d => <span key={+d}>{fmt(d, { weekday: 'short' })}</span>)}</div>
            <div className="calx__cells">
              {days.map(d => {
                const list = on(d), out = d.getMonth() !== anchor.getMonth(), isToday = sameDay(d, today)
                return (
                  <div key={+d} className={'calx__cell' + (out ? ' is-out' : '') + (isToday ? ' is-today' : '') + (d.getDay() % 6 === 0 ? ' is-weekend' : '')}>
                    <button type="button" className="calx__date" onClick={() => goDay(d)} aria-label={`Open ${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}`}>{d.getDate()}</button>
                    {list.slice(0, 3).map(x => (
                      <button key={x.t + x.title} type="button" className={'calx__chip' + (x.done ? ' is-done' : '')} style={evtStyle(x)} onClick={() => open(x)} aria-label={label(x)}>
                        <i /><span className={'calx__chip-time' + (x.late ? ' is-late' : '')}>{timeOf(x.t).replace(':00', '')}</span><span className="calx__chip-title">{x.title}</span>
                      </button>
                    ))}
                    {list.length > 3 && <button type="button" className="calx__more" onClick={() => goDay(d)}>{list.length - 3} more</button>}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="calx__time" style={{ ['--days' as string]: days.length, ['--row' as string]: ROW + 'px' }}>
            <div className="calx__head">
              <span className="calx__corner" />
              {days.map(d => (
                <button key={+d} type="button" className={'calx__day' + (sameDay(d, today) ? ' is-today' : '')} onClick={() => goDay(d)} disabled={mode === 'day'}>
                  <span>{fmt(d, { weekday: 'short' })}</span><b>{d.getDate()}</b>
                </button>
              ))}
            </div>
            <div className="calx__body" ref={body}>
              <div className="calx__gutter" aria-hidden="true">{Array.from({ length: 24 }, (_, h) => <span key={h} style={{ top: h * ROW }}>{h ? hh(h) : ''}</span>)}</div>
              <div className="calx__grid">
                {days.map(d => {
                  const isToday = sameDay(d, today), m = today.getHours() * 60 + today.getMinutes()
                  return (
                    <div key={+d} className={'calx__col' + (isToday ? ' is-today' : '') + (d.getDay() % 6 === 0 ? ' is-weekend' : '')} onClick={e => slotClick(d, e)}
                      title="Click an empty time to schedule a task">
                      {lanesFor(on(d)).map(p => {
                        const { x } = p, dt = new Date(x.t)
                        const top = (dt.getHours() * 60 + dt.getMinutes()) / 60 * ROW
                        const height = Math.max(x.dur / 60 * ROW - 3, 22), w = 100 / p.lanes
                        return (
                          <button key={x.t + x.title} type="button" aria-label={label(x)}
                            className={'calx__evt' + (height < 42 ? ' is-short' : '') + (x.done ? ' is-done' : '') + (x.taskId || x.id ? '' : ' is-static')}
                            style={{ ...evtStyle(x), top, height, left: `calc(${p.lane * w}% + 3px)`, width: `calc(${w}% - 6px)` }}
                            onClick={() => open(x)}>
                            <b>{x.title}</b><span>{x.late && <em className="calx__late">Overdue · </em>}{timeOf(x.t)}{x.who ? ` · ${x.who}` : ''}</span>
                          </button>
                        )
                      })}
                      {isToday && <div className="calx__now" style={{ top: m / 60 * ROW }} aria-hidden="true" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>
      {sheet && <TaskSheet task={sheet.task} at={sheet.at} leads={leads} onClose={() => setSheet(null)} />}
    </>
  )
}
