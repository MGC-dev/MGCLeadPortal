import { useEffect, useRef } from 'react'
import { tasksApi, leadsApi, servicesApi, useQuery } from '../../api'
import type { Lead, Service } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { StageTag, Tag, usePhone } from '../../shared/ui'
import { initials, money, when } from '../../shared/format'
import { ACT_ICON, SOURCES, STAGES, STAGE, feeKnown, nextStep } from './selectors'
import { priceLabel } from '../services/pricing'

/** Side panel (bottom sheet on phones) with everything about one lead: actions, details and timeline. */
/** Name of what was sent: the document's name, or "Name + n more" for a packet. */
export const docTitle = (l: Lead) => {
  const names = l.doc?.items?.map(i => i.name) ?? []
  return names.length === 0 ? 'Engagement letter' : names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`
}

export function LeadInspector({ lead: l }: { lead: Lead }) {
  const { openLead, openModal } = useUi()
  const tasks = useQuery(() => tasksApi.list()) ?? []
  const catalog = useQuery(() => servicesApi.list()) ?? []
  const mine = (l.serviceIds ?? []).map(id => catalog.find(s => s.id === id)).filter((s): s is Service => !!s)
  const phone = usePhone()
  // Focus the panel (not a button) so the key that opened it cannot also activate Close.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { panel.current?.focus({ preventScroll: true }) }, [])
  const next = nextStep(l, tasks)
  const idx = l.stage === 'lost' ? -1 : STAGE[l.stage].i
  const working = l.stage !== 'lost' && l.stage !== 'delivered'
  const stage = (s: Lead['stage']) => leadsApi.setStage(l.id, s)

  let primary: React.ReactNode = null
  if (l.stage === 'new') primary = <button className="btn btn--prominent" type="button" onClick={() => leadsApi.logCall(l.id)}><Icon name="phone" small />Log Call</button>
  else if (l.stage === 'contacted') primary = <button className="btn btn--prominent" type="button" onClick={() => stage('consult')}><Icon name="calendar" small />Book Consultation</button>
  else if (l.stage === 'consult') primary = <button className="btn btn--prominent" type="button" disabled={!mine.length} title={mine.length ? undefined : 'Add the services first'} onClick={() => openModal({ type: 'send-docs', id: l.id })}><Icon name="doc" small />Send Contract</button>
  else if (l.stage === 'contract') primary = <button className="btn btn--prominent" type="button" onClick={() => leadsApi.sendForSignature(l.id)}><Icon name="pencil" small />Send for Signature</button>
  else if (l.stage === 'signed') primary = <button className="btn btn--prominent" type="button" onClick={() => openModal({ type: 'request-payment', id: l.id })}><Icon name="bolt" small />Request Payment</button>
  else if (l.stage === 'payment') primary = <button className="btn btn--prominent" type="button" onClick={() => stage('delivered')}><Icon name="check" small />Mark Services Provided</button>

  const stageName = l.stage === 'lost' ? 'Lost' : STAGES[idx].label
  const stageNo = l.stage === 'lost' ? null : `Step ${idx + 1} of ${STAGES.length}`
  const details: [string, string, string][] = [
    ['mail', 'Email', l.email], ['phone', 'Phone', l.phone], ['leads', 'Practice area', l.practice],
    ['globe', 'Source', SOURCES[l.source]], ['contacts', 'Owner', l.owner],
    ...(feeKnown(l) ? [['reports', 'Estimated fee', money(l.value)] as [string, string, string]] : []),
  ]

  return (
    <>
      <div className={'scrim' + (phone ? '' : ' scrim--light')} onClick={() => openLead(null)} />
      <aside ref={panel} tabIndex={-1} className="inspector lead" role="dialog" aria-modal="true" aria-labelledby="d-title">
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head lead__head">
          <span className="lead__avatar" aria-hidden="true">{initials(l.name)}</span>
          <div className="sheet-head__title">
            <h2 id="d-title">{l.name}</h2>
            <span className="footnote">{l.matter}</span>
          </div>
          <button className="closebtn" type="button" onClick={() => openLead(null)} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="inspector__body">
          <section className="lead__stage">
            <div className="lead__stage-row"><StageTag lead={l} /><span className="caption">{stageNo ?? 'Closed'}</span></div>
            <div className={'progress' + (l.stage === 'lost' ? ' progress--lost' : '')} aria-label={`Stage: ${stageName}`}>
              {STAGES.map((s, i) => <span key={s.id} title={s.label} className={l.stage === 'lost' || i <= idx ? 'on' : ''} />)}
            </div>
            <div className="progress-labels"><span className="caption">New Enquiry</span><span className="caption">Services Provided</span></div>
          </section>

          <section className="lead__actions">
            {primary}
            {working && (
              <div className="lead__secondary">
                <button className="btn" type="button" onClick={() => openModal({ type: 'compose', id: l.id })}><Icon name="messages" small />Send text</button>
                <button className="btn" type="button" onClick={() => openModal({ type: 'reminder', id: l.id })}><Icon name="bell" small />Reminder</button>
                {l.stage !== 'signed' && l.stage !== 'payment' && <button className="btn btn--destructive" type="button" onClick={() => openModal({ type: 'lost', id: l.id })}><Icon name="x" small />Mark lost</button>}
              </div>
            )}
            {l.stage === 'lost' && <button className="btn btn--prominent" type="button" onClick={() => stage('new')}>Reopen lead</button>}
          </section>

          {l.stage !== 'lost' && idx >= 2 && (
            <section className={'svcs' + (!mine.length && l.stage === 'consult' ? ' is-needed' : '')} aria-label="Services">
              <div className="svcs__head">
                <h3 className="lead__label">Services</h3>
                {working && <button className="svcs__add" type="button" aria-label={mine.length ? 'Add or edit services' : 'Add services'} title={mine.length ? 'Add or edit services' : 'Add services'} onClick={() => openModal({ type: 'pick-services', id: l.id })}><Icon name="plus" small /></button>}
              </div>
              {mine.length ? (
                <>
                  <ul className="svcs__list">{mine.map(s => <li key={s.id}><span><b>{s.name}</b><small>{s.practice}</small></span><em>{priceLabel(s)}</em></li>)}</ul>
                  <p className="svcs__total"><span>Estimated fee</span><b>{money(l.value)}</b></p>
                </>
              ) : (
                <p className="svcs__empty">Add the services {l.name.split(' ')[0]} is taking{l.stage === 'consult' ? ' before sending the contract' : ''}.</p>
              )}
            </section>
          )}

          {working
            ? (
              <div className="lead__next">
                <span className="lead__next-icon"><Icon name="calendar" /></span>
                <div><b>Next step</b><p>{next.text}{next.due ? ` · due ${when(next.due)}` : ''}</p></div>
              </div>
            )
            : l.lostReason && (
              <div className="lead__next lead__next--lost">
                <span className="lead__next-icon"><Icon name="x" /></span>
                <div><b>Reason lost</b><p>{l.lostReason}</p></div>
              </div>
            )}

          {l.doc && (
            <div className="lead__doc">
              <span className="lead__next-icon"><Icon name="doc" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{docTitle(l)}</b>
                <p>Sent {when(l.doc.sent)}{l.doc.signed ? `, signed ${when(l.doc.signed)}` : ''}</p>
              </div>
              {l.doc.status === 'signed' ? <Tag tone="green" icon="check">Signed</Tag> : <Tag tone="orange">Awaiting signature</Tag>}
            </div>
          )}

          <section className="lead__section">
            <h3 className="lead__label">Details</h3>
            <dl className="lead__details">
              {details.map(([icon, label, value]) => (
                <div key={label} className={label === 'Email' ? 'is-wide' : ''}>
                  <dt><Icon name={icon} small />{label}</dt>
                  <dd className={label === 'Estimated fee' ? 'num' : ''}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {l.notes && (
            <section className="lead__section">
              <h3 className="lead__label">Notes</h3>
              <p className="lead__notes">{l.notes}</p>
            </section>
          )}

          <section className="lead__section">
            <h3 className="lead__label">Activity</h3>
            <ol className="lead__timeline">
              {[...l.activities].reverse().map((a, i) => (
                <li key={i} className={a.cls}>
                  <span className="dot"><Icon name={ACT_ICON[a.type] || 'arrow'} /></span>
                  <div>
                    <div className="lead__tl-head"><b>{a.title}</b><span className="caption">{when(a.t)}</span></div>
                    {a.text && <p className="footnote">{a.text}</p>}
                    {a.quote && <p className="quote">{a.quote}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </>
  )
}
