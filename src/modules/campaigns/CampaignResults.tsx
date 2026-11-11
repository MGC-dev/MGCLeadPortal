import { campaignsApi, useQuery } from '../../api'
import type { Recipient } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Sheet, Tag } from '../../shared/ui'
import { ago, lower1 } from '../../shared/format'
import { AUDIENCES, campStats, useCampaigns } from './campaignUtils'

const Status = ({ r }: { r: Recipient }) =>
  r.status === 'skipped' ? <Tag>Skipped, opted out</Tag>
    : r.status === 'held' ? <Tag tone="orange">Held</Tag>
      : r.replied ? <Tag tone="green" icon="check">Replied</Tag>
        : r.opened ? <Tag tone="tint">Opened</Tag> : <Tag>Delivered</Tag>

/** Delivery results for one campaign; shows live progress while a one-off send is going out. */
export function CampaignResults({ id }: { id: string }) {
  const { openModal, openLead } = useUi()
  const c = useCampaigns()?.find(x => x.id === id)
  const sending = useQuery(() => campaignsApi.progress())
  if (!c) return null
  const st = campStats(c)
  const live = sending && sending.id === c.id
  const tiles: [string, string | number][] = [['Delivered', st.sent], ...(st.email ? [['Opened', Math.round(st.opened / st.email * 100) + '%'] as [string, string]] : []), ['Replied', st.replied], ['Held', st.held], ['Skipped', st.skipped]]
  const sub = c.kind === 'broadcast'
    ? `One-off ${c.channel.toLowerCase()} to ${AUDIENCES[c.audience!].label.toLowerCase()}`
    : `Automatic ${c.channel.toLowerCase()}, when ${lower1(c.trigger ?? '')}`
  return (
    <Sheet title={c.name} sub={sub} onClose={() => openModal(null)}>
      {live && (
        <div className="sendbar">
          <div className="sendbar__track"><span style={{ width: `${Math.round(sending.done / sending.total * 100)}%` }} /></div>
          <span className="footnote num">Sending {sending.done} of {sending.total}…</span>
        </div>
      )}
      <div className="summary summary--sheet">{tiles.map(([t, v]) => <div className="tile" key={t}><span>{t}</span><b>{v}</b></div>)}</div>
      {c.recipients.length ? (
        <ul className="group rows">
          {c.recipients.slice(0, 40).map((r, i) => (
            <li key={i}><button type="button" className="row" onClick={() => { openModal(null); openLead(r.id) }}>
              <span className="row__main"><b>{r.name}</b><span>{r.channel}{r.at ? ` · ${ago(r.at)}` : ''}</span></span>
              <span className="row__end"><Status r={r} /></span>
            </button></li>
          ))}
        </ul>
      ) : (
        <div className="group empty"><Icon name="campaigns" /><p>{c.kind === 'auto' ? `Nobody has received this yet. It sends by itself when ${lower1(c.trigger ?? '')}.` : 'No recipients yet.'}</p></div>
      )}
    </Sheet>
  )
}
