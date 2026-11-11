import { campaignsApi } from '../../api'
import type { Campaign } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Tag } from '../../shared/ui'
import { lower1, when } from '../../shared/format'
import { AUDIENCES, campStats, fillIn, useCampaigns, useFirm } from './campaignUtils'
import { useNavigate } from 'react-router-dom'

export default function Campaigns() {
  const camps = useCampaigns()
  const firm = useFirm()
  const navigate = useNavigate()
  const { openModal } = useUi()
  if (!camps || !firm) return null
  const canEmail = firm.domainStatus === 'verified', canText = firm.textStatus === 'registered'
  const locked = !canEmail || !canText

  const card = (c: Campaign) => {
    const st = campStats(c)
    return (
      <article className="group camp" key={c.id}>
        <div className="camp__top">
          {c.kind === 'broadcast' ? (
            <>
              <div style={{ display: 'grid', gap: 2 }}><h3>{c.name}</h3><span className="footnote">{c.sentAt ? `Sent ${when(c.sentAt)} to ${AUDIENCES[c.audience!].label.toLowerCase()}` : 'Sending now…'}</span></div>
              <Tag tone="accent">One-Off</Tag>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 2 }}><h3>{c.name}</h3><span className="footnote">When {lower1(c.trigger ?? '')}</span></div>
              <div className="switchrow">
                <span aria-hidden="true">{c.active ? 'On' : 'Off'}</span>
                <button type="button" className="switch" role="switch" aria-checked={!!c.active} aria-label={c.name} onClick={() => campaignsApi.toggle(c.id)} />
              </div>
            </>
          )}
        </div>
        <p className="camp__preview">{c.subject && <b>{fillIn(c.subject, null, firm.name)}{'\n'}</b>}{fillIn(c.body, null, firm.name)}</p>
        <div className="camp__meta">
          <Tag>{c.channel}</Tag>
          {c.kind === 'auto' && <Tag>{c.steps}{c.steps === 1 ? ' Step' : ' Steps'}</Tag>}
          <span className="footnote num">{st.sent} sent{st.opened ? ` · ${st.opened} opened` : ''}{st.replied ? ` · ${st.replied} replied` : ''}{st.held ? ` · ${st.held} held` : ''}</span>
          <button className="btn btn--plain btn--sm camp__results" type="button" onClick={() => openModal({ type: 'camp', id: c.id })}>View Results</button>
        </div>
      </article>
    )
  }
  const auto = camps.filter(c => c.kind === 'auto'), one = camps.filter(c => c.kind === 'broadcast')
  const newCard = (kind: 'auto' | 'broadcast', t: string, sub: string) => (
    <button type="button" className="group camp camp--new" onClick={() => openModal({ type: 'newcamp', kind })}><Icon name="plus" /><b>{t}</b><span className="footnote">{sub}</span></button>
  )
  return (
    <>
      {locked && (
        <div className="group callout">
          <div className="callout__text"><Icon name="alert" />
            <div><b>Some campaign messages are held</b>
              <p className="footnote">They send once {[!canEmail ? 'your email domain is verified' : null, !canText ? 'your texting number is registered' : null].filter(Boolean).join(' and ')}.</p></div>
          </div>
          <button className="btn btn--sm" type="button" onClick={() => navigate('/settings')}>Open Settings</button>
        </div>
      )}
      <div><p className="section-title">One-Off Sends ({one.length})</p>
        <div className="grid2">{one.map(card)}{newCard('broadcast', 'New One-Off Send', 'Email or text a group of contacts once, now.')}</div></div>
      <div><p className="section-title">Automatic ({auto.length})</p>
        <div className="grid2">{auto.map(card)}{newCard('auto', 'New Automatic Campaign', 'Runs by itself when something happens in the pipeline.')}</div></div>
    </>
  )
}
