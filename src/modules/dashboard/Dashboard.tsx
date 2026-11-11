import { useNavigate } from 'react-router-dom'
import { tasksApi, campaignsApi, eventsApi, firmApi, leadsApi, useQuery } from '../../api'
import { DAY, config } from '../../api/mockData'
import type { Task, Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Tag } from '../../shared/ui'
import { ago, dayAt, endOfToday, money, timeOf, when } from '../../shared/format'
import { calEvents } from '../calendar/calendarEvents'
import { campStats } from '../campaigns/campaignUtils'
import { ACT_ICON, SOURCES, STAGE, STAGES, isOpen, isWon, feeKnown } from '../lead/selectors'
import { InfoTip } from '../../shared/InfoTip'

// Sample history for the overview chart (the sample firm has only a handful of real leads).
const ENQ_HISTORY = [3, 4, 2, 5, 3, 1, 1, 4, 6, 3, 5, 4, 2]

function enquirySeries(leads: Lead[]) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = 13 - i, s = dayAt(-d), e = s + DAY
    const real = leads.filter(l => l.created >= s && l.created < e).length
    return { day: new Date(s), n: (d === 0 ? 0 : ENQ_HISTORY[i] || 0) + real }
  })
}

function TaskRow({ a, lead }: { a: Task; lead?: Lead }) {
  const { openLead } = useUi()
  const late = a.dueAt < Date.now()
  return (
    <li><div className="row task">
      <button className="check" type="button" role="checkbox" aria-checked={a.done} aria-label={`Done: ${a.title}`} onClick={() => tasksApi.toggle(a.id)}><Icon name="check" /></button>
      <button className="task__open" type="button" onClick={() => lead && openLead(lead.id)}>
        <span className="row__main"><b>{a.title}</b><span>{lead ? `${lead.name} · ${lead.matter}` : 'Firm'}</span></span>
        <span className="row__end">{late ? <Tag tone="red">Overdue</Tag> : <Tag tone="accent">{when(a.dueAt)}</Tag>}<span className="caption">{a.assignedTo}</span></span>
      </button>
    </div></li>
  )
}

export default function Dashboard() {
  const leads = useQuery(() => leadsApi.list())
  const tasks = useQuery(() => tasksApi.list())
  const events = useQuery(() => eventsApi.list())
  const camps = useQuery(() => campaignsApi.list())
  const firm = useQuery(() => firmApi.get())
  const navigate = useNavigate()
  const { openLead, openModal } = useUi()
  if (!leads || !tasks || !events || !camps || !firm) return null

  const now = Date.now(), eod = endOfToday(), sod = dayAt(0)
  const go = (p: string) => navigate(p)
  const series = enquirySeries(leads)
  const thisWeek = series.slice(7).reduce((a, x) => a + x.n, 0), lastWeek = series.slice(0, 7).reduce((a, x) => a + x.n, 0)
  const delta = lastWeek ? Math.round((thisWeek - lastWeek) / lastWeek * 100) : 0
  const open = leads.filter(isOpen)
  const won = leads.filter(isWon)
  const reached = leads.filter(l => l.stage === 'lost' ? l.activities.some(a => a.type === 'meeting') : STAGE[l.stage].i >= 2)
  const conv = reached.length ? Math.round(won.length / reached.length * 100) : 0
  const canEmail = firm.domainStatus === 'verified', canText = firm.textStatus === 'registered'
  const missing = [!canEmail ? 'your email domain is verified' : null, !canText ? 'your texting number is registered' : null].filter(Boolean).join(' and ')

  const max = Math.max(...series.map(x => x.n), 1)
  const ticks = [max, Math.round(max / 2), 0]

  const todays = calEvents(tasks, leads, events).filter(x => x.t >= sod && x.t <= eod).sort((x, y) => x.t - y.t)
  const nextUp = todays.length ? todays : calEvents(tasks, leads, events).filter(x => x.t > eod).sort((x, y) => x.t - y.t).slice(0, 4)

  const funnelStages = STAGES.slice(0, 6)
  const counts = funnelStages.map(s => leads.filter(l => l.stage !== 'lost' && STAGE[l.stage].i >= STAGE[s.id].i).length)
  const fmax = Math.max(...counts, 1)
  const lost = leads.filter(l => l.stage === 'lost').length

  const src = (Object.keys(config.sources) as (keyof typeof SOURCES)[]).map(k => { const ls = leads.filter(l => l.source === k); return { k, n: ls.length, w: ls.filter(isWon).length } }).filter(x => x.n).sort((x, y) => y.n - x.n)
  const smax = Math.max(...src.map(x => x.n), 1)

  const attention = tasks.filter(a => !a.done && a.dueAt <= eod).slice(0, 5)
  const feed = leads.flatMap(l => l.activities.map(a => ({ ...a, l }))).filter(a => a.t <= now).sort((x, y) => y.t - x.t).slice(0, 6)
  // documents sent to leads, newest activity first: where to see what is awaiting signature and what is signed
  const sentDocs = leads.filter(l => l.doc).map(l => ({ l, d: l.doc!, t: l.doc!.signed ?? l.doc!.sent }))
    .sort((x, y) => y.t - x.t)
  const awaiting = sentDocs.filter(x => x.d.status !== 'signed').length
  const autos = camps.filter(c => c.kind === 'auto'), on = autos.filter(c => c.active).length
  const lastSend = camps.filter(c => c.kind === 'broadcast' && c.sentAt).sort((x, y) => y.sentAt! - x.sentAt!)[0]
  const ls = lastSend ? campStats(lastSend) : null

  return (
    <>
      {!(canEmail && canText) && (
        <div className="banner"><Icon name="alert" /><span><b>Sending is not set up yet.</b> Campaign messages are held until {missing}.</span>
          <button className="btn btn--sm" type="button" onClick={() => go('/settings')}>Finish Setup</button></div>
      )}
      <div className="kpis">
        <div className="kpi kpi--hero"><span className="kpi__label">New Enquiries, This Week</span><b className="kpi__value">{thisWeek}</b>
          <span className={'kpi__delta ' + (delta >= 0 ? 'is-up' : 'is-down')}><Icon name="arrow" small />{Math.abs(delta)}% vs last week</span></div>
        <div className="kpi"><span className="kpi__label">Median First Response</span><b className="kpi__value">14<small> min</small></b><Tag tone="green" icon="check">Under 1 hour target</Tag></div>
        <div className="kpi"><span className="kpi__label">Consultation to Signed</span><b className="kpi__value">{conv}<small>%</small></b><span className="kpi__sub">{won.length} of {reached.length} consultations</span></div>
        <div className="kpi"><span className="kpi__label">Open Pipeline</span><b className="kpi__value">{money(open.filter(feeKnown).reduce((a, l) => a + l.value, 0))}</b><span className="kpi__sub">{open.length} open leads</span></div>
      </div>

      <div className="dash dash--a">
        <section className="group panel panel--chart">
          <div className="panel__head"><div className="titlerow"><h2>Enquiries</h2><InfoTip text="New enquiries over the last 14 days, from all sources." label="About Enquiries" /></div><button className="btn btn--plain btn--sm" type="button" onClick={() => go('/reports')}>Reports</button></div>
          <div className="chart">
            <div className="chart__y">{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
            <div className="chart__plot">
              {series.map((x, i) => {
                const lab = x.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                const isToday = i === 13
                const pos = { left: `calc(${i} * 100% / 14)`, width: 'calc(100% / 14)' }
                const ht = Math.max(x.n / max * 100, x.n ? 3 : 0)
                return (
                  <span key={i}>
                    <div className={'vbar' + (isToday ? ' is-today' : '')} style={{ ...pos, ['--h' as string]: ht + '%' }} tabIndex={0} role="img" aria-label={`${lab}: ${x.n} enquiries`} data-tip={`${lab} · ${x.n} ${x.n === 1 ? 'enquiry' : 'enquiries'}`}><span style={{ height: ht + '%' }} /></div>
                    <em className={'vbar__x' + (isToday ? ' is-today' : '')} style={pos}>{i % 2 === 1 || isToday ? (isToday ? 'Today' : x.day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : ''}</em>
                  </span>
                )
              })}
            </div>
          </div>
        </section>
        <section className="group panel">
          <div className="panel__head"><div><h2>{todays.length ? 'Today' : 'Coming Up'}</h2><p className="footnote">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
            <button className="btn btn--plain btn--sm" type="button" onClick={() => go('/calendar')}>Calendar</button></div>
          {nextUp.length ? (
            <ul className="schedule">{nextUp.map((x, i) => (
              <li key={i} className={x.firm ? 'is-firm' : undefined}>
                {x.id ? <button type="button" onClick={() => openLead(x.id!)}>{inner(x)}</button> : <div>{inner(x)}</div>}
              </li>
            ))}</ul>
          ) : <div className="empty"><p>Nothing booked.</p></div>}
        </section>
      </div>

      <div className="dash dash--b">
        <section className="group panel">
          <div className="panel__head"><div><h2>Needs Attention</h2><p className="footnote">{attention.length ? `${attention.length} follow-up${attention.length === 1 ? '' : 's'} due today` : 'Nothing due today'}</p></div>
            <button className="btn btn--plain btn--sm" type="button" onClick={() => go('/tasks')}>Tasks</button></div>
          {attention.length ? <ul className="rows">{attention.map(a => <TaskRow key={a.id} a={a} lead={leads.find(l => l.id === a.leadId)} />)}</ul>
            : <div className="empty"><Icon name="check" /><p>You are all caught up.</p></div>}
        </section>
        <section className="group panel">
          <div className="panel__head"><div className="titlerow"><h2>Pipeline</h2><InfoTip text="How many leads have reached each stage." label="About Pipeline" /></div><button className="btn btn--plain btn--sm" type="button" onClick={() => go('/pipeline')}>Board</button></div>
          <ol className="funnel">
            {funnelStages.map((s, i) => <li key={s.id}><span className="funnel__label">{s.label}</span><span className="funnel__track"><span style={{ width: counts[i] / fmax * 100 + '%' }} /></span><b>{counts[i]}</b></li>)}
            <li className="is-lost"><span className="funnel__label">Lost</span><span className="funnel__track"><span style={{ width: lost / fmax * 100 + '%' }} /></span><b>{lost}</b></li>
          </ol>
        </section>
        <section className="group panel">
          <div className="panel__head"><div className="titlerow"><h2>Lead Sources</h2><InfoTip text="Where leads come from, and how many of them signed." label="About Lead Sources" /></div></div>
          <ul className="hbars">{src.map(x => <li key={x.k}><span className="hbars__label">{SOURCES[x.k]}</span><span className="hbars__track"><span style={{ width: x.n / smax * 100 + '%' }} /></span><b>{x.n}</b><span className="hbars__sub">{x.w ? `${x.w} signed` : '–'}</span></li>)}</ul>
        </section>
      </div>

      <div className="dash dash--c">
        <section className="group panel">
          <div className="panel__head"><div className="titlerow"><h2>Recent Activity</h2><InfoTip text="The latest activity across every lead." label="About Recent Activity" /></div></div>
          <ul className="timeline">{feed.map((a, i) => (
            <li key={i} className={a.cls}><span className="dot"><Icon name={ACT_ICON[a.type] || 'arrow'} /></span>
              <div><b>{a.title}</b><p className="footnote"><button type="button" className="linkbtn" onClick={() => openLead(a.l.id)}>{a.l.name}</button> · {ago(a.t)}</p></div></li>
          ))}</ul>
        </section>
        <div className="dash__stack">
        <section className="group panel docact">
          <div className="panel__head"><div><h2>Document Activity</h2><p className="footnote">{sentDocs.length ? `${awaiting} awaiting signature · ${sentDocs.length - awaiting} signed` : 'Nothing sent yet'}</p></div></div>
          {sentDocs.length ? (
            <ul className="rows">{sentDocs.slice(0, 5).map(({ l, d, t }) => (
              <li key={l.id}><button type="button" className="row" onClick={() => openLead(l.id)}>
                <Icon name="doc" /><span className="row__main"><b>{d.items?.map(i => i.name).join(', ') || 'Engagement letter'}</b><span>{l.name} · {d.status === 'signed' ? 'signed' : 'sent'} {when(t)}</span></span>
                <span className="row__end">{d.status === 'signed' ? <Tag tone="green" icon="check">Signed</Tag> : <Tag tone="orange">Awaiting signature</Tag>}</span>
              </button></li>
            ))}</ul>
          ) : <div className="empty"><Icon name="doc" /><p>Documents you send for signature show up here.</p></div>}
        </section>
        <section className="group panel">
          <div className="panel__head"><div><h2>Campaigns</h2><p className="footnote">{on} of {autos.length} automatic campaigns on</p></div><button className="btn btn--plain btn--sm" type="button" onClick={() => go('/campaigns')}>Campaigns</button></div>
          {lastSend && ls && (
            <div className="campmini"><span className="caption">Last one-off send</span><b>{lastSend.name}</b><span className="footnote">{when(lastSend.sentAt!)}</span>
              <div className="campmini__stats"><span><b>{ls.sent}</b>Delivered</span><span><b>{ls.email ? Math.round(ls.opened / ls.email * 100) + '%' : '–'}</b>Opened</span><span><b>{ls.replied}</b>Replied</span></div></div>
          )}
          <div className="panel__foot"><button className="btn btn--sm btn--prominent" type="button" onClick={() => openModal({ type: 'newcamp', kind: 'broadcast' })}><Icon name="plus" small />New Campaign</button></div>
        </section>
        </div>
      </div>
    </>
  )

  function inner(x: { t: number; title: string; who: string; late?: boolean }) {
    return (
      <>
        <span className="schedule__time">{todays.length ? timeOf(x.t) : `${new Date(x.t).toLocaleDateString('en-US', { weekday: 'short' })} ${timeOf(x.t)}`}</span>
        <span className="schedule__bar" aria-hidden="true" />
        <span className="schedule__main"><b>{x.title}</b><span>{x.who}</span></span>
        {x.late && <Tag tone="red">Overdue</Tag>}
      </>
    )
  }
}
