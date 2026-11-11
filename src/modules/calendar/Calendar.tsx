import { useState } from 'react'
import { tasksApi, eventsApi, leadsApi, useQuery } from '../../api'
import { DAY } from '../../api/mockData'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { dayAt, timeOf } from '../../shared/format'
import { calEvents, type CalEvent } from './calendarEvents'

const CAL_START = 7, CAL_END = 20, CAL_ROW = 52
const hh = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`

export default function Calendar() {
  const tasks = useQuery(() => tasksApi.list())
  const leads = useQuery(() => leadsApi.list())
  const events = useQuery(() => eventsApi.list())
  const { filter, openLead } = useUi()
  const [calAt, setCalAt] = useState(() => dayAt(0))
  if (!tasks || !leads || !events) return null

  const mode = filter.calmode
  const start = new Date(calAt)
  if (mode === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  const n = mode === 'week' ? 7 : 1
  const days = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const today = new Date().toDateString(), last = days[n - 1]
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', o)
  const range = n === 1 ? fmt(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : start.getMonth() === last.getMonth() ? `${fmt(start, { month: 'long' })} ${start.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
      : `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(last, { month: 'short', day: 'numeric' })}, ${last.getFullYear()}`
  const evts = calEvents(tasks, leads, events)
  const hours = CAL_END - CAL_START
  const shift = (dir: number) => { const d = new Date(calAt); d.setDate(d.getDate() + dir * (mode === 'week' ? 7 : 1)); setCalAt(+d) }

  const column = (d: Date) => {
    const s = +d, e = s + DAY
    const list = evts.filter(x => x.t >= s && x.t < e).sort((x, y) => x.t - y.t)
    const lanes: number[] = []
    const placed = list.map(x => {
      const end = x.t + x.dur * 60e3
      let lane = lanes.findIndex(l => l <= x.t)
      if (lane < 0) { lane = lanes.length; lanes.push(0) }
      lanes[lane] = end
      return { x, end, lane }
    })
    return placed.map(p => ({ ...p, lanes: Math.max(...placed.filter(y => y.x.t < p.end && y.end > p.x.t).map(y => y.lane)) + 1 }))
  }

  const block = (p: { x: CalEvent; lane: number; lanes: number }) => {
    const { x } = p, dt = new Date(x.t)
    const mins = Math.min(Math.max((dt.getHours() - CAL_START) * 60 + dt.getMinutes(), 0), hours * 60 - 20)
    const top = mins / 60 * CAL_ROW, height = Math.max(x.dur / 60 * CAL_ROW - 2, 22), w = 100 / p.lanes
    const cls = 'cal__evt' + (x.firm ? ' is-firm' : '') + (x.done ? ' is-done' : '') + (x.late ? ' is-late' : '') + (height < 40 ? ' is-short' : '')
    const style = { top, height, left: `calc(${p.lane * w}% + 2px)`, width: `calc(${w}% - 6px)` }
    const label = `${x.title}, ${x.who}, ${fmt(dt, { weekday: 'long' })} ${timeOf(x.t)}`
    const inner = <><b>{x.title}</b><span>{timeOf(x.t)}{x.who ? ` · ${x.who}` : ''}</span></>
    return x.id
      ? <button key={x.t + x.title} type="button" className={cls} style={style} onClick={() => openLead(x.id!)} aria-label={label}>{inner}</button>
      : <div key={x.t + x.title} className={cls} style={style} aria-label={label}>{inner}</div>
  }

  const early = evts.filter(x => x.t >= +start && x.t < +start + n * DAY && (new Date(x.t).getHours() < CAL_START || new Date(x.t).getHours() >= CAL_END)).length
  return (
    <div className="group cal" style={{ ['--days' as string]: n, ['--row' as string]: CAL_ROW + 'px', ['--hours' as string]: hours }}>
      <div className="cal__bar">
        <button className="btn btn--sm" type="button" onClick={() => setCalAt(dayAt(0))}>Today</button>
        <div className="cal__nav">
          <button className="btn btn--icon btn--sm" type="button" onClick={() => shift(-1)} aria-label={`Previous ${mode}`}><Icon name="chev" /></button>
          <button className="btn btn--icon btn--sm" type="button" onClick={() => shift(1)} aria-label={`Next ${mode}`}><Icon name="chev" /></button>
        </div>
        <h2>{range}</h2>
        <span className="cal__legend"><i className="is-lead" />Follow-ups <i className="is-firm" />Firm events</span>
      </div>
      <div className="cal__head">
        <div className="cal__corner" />
        {days.map(d => <div key={+d} className={'cal__day' + (d.toDateString() === today ? ' is-today' : '')}><span>{fmt(d, { weekday: 'short' }).toUpperCase()}</span><b>{d.getDate()}</b></div>)}
      </div>
      <div className="cal__body">
        <div className="cal__gutter">{Array.from({ length: hours }, (_, i) => <span key={i} style={{ top: i * CAL_ROW }}>{i ? hh(CAL_START + i) : ''}</span>)}</div>
        <div className="cal__grid">
          {days.map(d => {
            const t = new Date(), m = (t.getHours() - CAL_START) * 60 + t.getMinutes()
            return (
              <div key={+d} className={'cal__col' + (d.toDateString() === today ? ' is-today' : '')}>
                {column(d).map(block)}
                {d.toDateString() === today && m >= 0 && m <= hours * 60 && <div className="cal__now" style={{ top: m / 60 * CAL_ROW }} aria-hidden="true" />}
              </div>
            )
          })}
        </div>
      </div>
      {early > 0 && <p className="footnote cal__note">{early} item{early === 1 ? '' : 's'} outside 7 AM to 8 PM are pinned to the edge of the day.</p>}
    </div>
  )
}
