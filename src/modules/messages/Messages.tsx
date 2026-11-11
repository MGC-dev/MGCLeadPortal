import { leadsApi, useQuery } from '../../api'
import type { Activity, Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Empty, Tag } from '../../shared/ui'
import { ago, when } from '../../shared/format'

const Kind = ({ a }: { a: Activity }) =>
  a.type === 'enquiry' ? <Tag>Received</Tag> : a.cls === 'bad' ? <Tag tone="red" icon="alert">Held</Tag> : <Tag tone="tint">{a.type === 'text' ? 'Text' : 'Email'} Sent</Tag>

/** Every text and email across all leads, newest first. */
export default function Messages() {
  const leads = useQuery(() => leadsApi.list())
  const { filter, openLead } = useUi()
  if (!leads) return null
  const f = filter.inbox
  const all: { l: Lead; a: Activity }[] = []
  leads.forEach(l => l.activities.forEach(a => { if ((f === 'all' && ['text', 'email', 'enquiry'].includes(a.type)) || a.type === f) all.push({ l, a }) }))
  all.sort((x, y) => y.a.t - x.a.t)
  if (!all.length) return <Empty icon="messages">No messages yet. They appear here as soon as an enquiry comes in.</Empty>
  const items = all.slice(0, 40)
  return (
    <>
      <div className="group only-desk"><div className="table-wrap">
        <table style={{ minWidth: 720 }}>
          <thead><tr><th>Contact</th><th>Type</th><th>Message</th><th>When</th></tr></thead>
          <tbody>{items.map(({ l, a }, i) => (
            <tr key={i} onClick={() => openLead(l.id)}>
              <td><b>{l.name}</b></td><td><Kind a={a} /></td>
              <td>{a.title}{a.quote && <><br /><span className="footnote">{a.quote.slice(0, 110)}</span></>}</td>
              <td className="footnote" style={{ whiteSpace: 'nowrap' }}>{when(a.t)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div></div>
      <ul className="group rows only-phone">{items.map(({ l, a }, i) => (
        <li key={i}><button type="button" className="row" onClick={() => openLead(l.id)}>
          <span className="row__main"><b>{l.name}</b><span>{a.quote || a.title}</span></span>
          <span className="row__end"><span className="caption">{ago(a.t)}</span><Kind a={a} /></span><Icon name="chev" small className="chev" />
        </button></li>
      ))}</ul>
    </>
  )
}
