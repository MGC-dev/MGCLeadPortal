import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight } from '@tabler/icons-react'
import type { Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Tag, usePhone } from '../../shared/ui'
import { initials, money, when } from '../../shared/format'
import { servicesApi, useQuery } from '../../api'
import { priceLabel } from '../services/pricing'
import { SOURCES, feeKnown } from './selectors'

/**
 * Lead profile (opened from the Leads module): who the lead is and what they asked for.
 * The working view, with actions and activity, is the ticket in the Pipeline; the View in Pipeline button jumps there.
 */
export function LeadProfile({ lead: l }: { lead: Lead }) {
  const { openProfile, openLead } = useUi()
  const navigate = useNavigate()
  const phone = usePhone()
  const panel = useRef<HTMLElement>(null)
  const catalog = useQuery(() => servicesApi.list()) ?? []
  const mine = (l.serviceIds ?? []).map(id => catalog.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s)
  useEffect(() => { panel.current?.focus({ preventScroll: true }) }, [])

  const openTicket = () => {
    navigate('/pipeline')
    // the route change closes open panels, so open the ticket once it has settled
    setTimeout(() => openLead(l.id), 120)
  }

  return (
    <>
      <div className={'scrim' + (phone ? '' : ' scrim--light')} onClick={() => openProfile(null)} />
      <aside ref={panel} tabIndex={-1} className="inspector lead profile" role="dialog" aria-modal="true" aria-labelledby="p-title">
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head lead__head">
          <span className="lead__avatar" aria-hidden="true">{initials(l.name)}</span>
          <div className="sheet-head__title">
            <h2 id="p-title">{l.name}</h2>
            <span className="footnote">{l.matter}</span>
          </div>
          <button className="closebtn" type="button" onClick={() => openProfile(null)} aria-label="Close"><Icon name="x" /></button>
        </div>

        <div className="inspector__body">
          <button className="btn btn--prominent profile__ticket" type="button" onClick={openTicket} title="Open this lead's ticket in the Pipeline">
            View in Pipeline<IconArrowRight size={18} stroke={2.2} />
          </button>

          <section className="lead__section">
            <h3 className="lead__label">Contact</h3>
            <dl className="lead__details">
              <div className="is-wide"><dt><Icon name="mail" small />Email</dt><dd><a href={`mailto:${l.email}`}>{l.email}</a></dd></div>
              <div className="is-wide"><dt><Icon name="phone" small />Phone</dt><dd><a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}>{l.phone}</a></dd></div>
            </dl>
          </section>

          <section className="lead__section">
            <h3 className="lead__label">Enquiry</h3>
            <dl className="lead__details">
              <div className="is-wide"><dt><Icon name="folder" small />Matter</dt><dd>{l.matter}</dd></div>
              {mine.length > 0 && <div className="is-wide"><dt><Icon name="services" small />Services</dt><dd>{mine.map(s => <div key={s.id}>{s.name} <span className="caption">· {priceLabel(s)}</span></div>)}</dd></div>}
              <div><dt><Icon name="leads" small />Practice area</dt><dd>{l.practice}</dd></div>
              {feeKnown(l) && <div><dt><Icon name="reports" small />Estimated fee</dt><dd className="num">{money(l.value)}</dd></div>}
              <div><dt><Icon name="globe" small />Source</dt><dd>{SOURCES[l.source]}</dd></div>
              <div><dt><Icon name="contacts" small />Owner</dt><dd>{l.owner}</dd></div>
              <div className="is-wide"><dt><Icon name="calendar" small />Received</dt><dd>{when(l.created)}</dd></div>
            </dl>
          </section>

          {l.notes && (
            <section className="lead__section">
              <h3 className="lead__label">Notes</h3>
              <p className="lead__notes">{l.notes}</p>
            </section>
          )}

          {l.doc && (
            <section className="lead__section">
              <h3 className="lead__label">Documents</h3>
              <div className="lead__doc">
                <span className="lead__next-icon"><Icon name="doc" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{l.doc.items?.map(i => i.name).join(', ') || 'Engagement letter'}</b>
                  <p>Sent {when(l.doc.sent)}{l.doc.signed ? `, signed ${when(l.doc.signed)}` : ''}</p>
                </div>
                {l.doc.status === 'signed' ? <Tag tone="green" icon="check">Signed</Tag> : <Tag tone="orange">Awaiting signature</Tag>}
              </div>
            </section>
          )}

          {l.stage === 'lost' && l.lostReason && (
            <div className="lead__next lead__next--lost">
              <span className="lead__next-icon"><Icon name="x" /></span>
              <div><b>Reason lost</b><p>{l.lostReason}</p></div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
