import { useState } from 'react'
import { leadsApi, servicesApi, useQuery } from '../../api'
import type { Lead } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { Icon } from '../../shared/Icon'
import { Sheet } from '../../shared/ui'
import { first, money } from '../../shared/format'
import { feeOf, paymentDue, priceLabel, retainerLabel, retainerOf } from '../services/pricing'
import { InfoTip } from '../../shared/InfoTip'

/**
 * Shown before the ticket moves to Payment Pending: confirm the services the client took and the total,
 * then request the payment. The services can be changed from here.
 */
export function RequestPaymentModal({ lead: l }: { lead: Lead }) {
  const { openModal } = useUi()
  const catalog = useQuery(() => servicesApi.list()) ?? []
  const [busy, setBusy] = useState(false)
  const mine = (l.serviceIds ?? []).map(id => catalog.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s)
  const due = paymentDue(mine)
  const close = () => openModal(null)

  const confirm = async () => {
    if (busy || !mine.length) return
    setBusy(true)
    await leadsApi.setStage(l.id, 'payment')
    close()
  }

  return (
    <Sheet className="reqpay" title="Request payment" sub={`For ${l.name} | ${l.matter}`} icon={<Icon name="bolt" />} onClose={close}
      foot={
        <div className="reqpay__foot">
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn btn--prominent" type="button" onClick={confirm} disabled={busy || !mine.length}>
            {due > 0 ? `Request ${money(due)}` : 'Move to Payment Pending'}
          </button>
        </div>
      }>
      <div className="reqpay__body">
        <div className="reqpay__headline">
          <div className="titlerow"><h3>Confirm the services {first(l.name)} is taking</h3>{mine.length > 0 && <InfoTip label="About the amount" text={retainerOf(mine) > 0 ? 'The retainer is requested before work starts.' : feeOf(mine) > 0 ? 'These services have no retainer, so the full estimated fee is requested.' : 'These services are paid on contingency, so nothing is requested upfront.'} />}</div>
          <button type="button" className="btn btn--sm" onClick={() => openModal({ type: 'pick-services', id: l.id, next: 'request-payment' })}>
            {mine.length ? 'Edit services' : 'Add services'}
          </button>
        </div>

        {mine.length === 0 ? (
          <div className="reqpay__empty"><Icon name="services" /><p>No services are on this ticket yet. Add the services {first(l.name)} is taking, then request the payment.</p></div>
        ) : (
          <>
            <ul className="reqpay__list">
              {mine.map(s => (
                <li key={s.id}>
                  <span><b>{s.name}</b><small>{s.practice} · {priceLabel(s)}</small></span>
                  <span className="reqpay__ret"><small>Retainer</small><b>{retainerLabel(s)}</b></span>
                </li>
              ))}
            </ul>
            <div className="reqpay__totals">
              <div><span>Estimated fee</span><b>{money(feeOf(mine))}</b></div>
              <div><span>Retainer</span><b>{retainerOf(mine) > 0 ? money(retainerOf(mine)) : 'None'}</b></div>
              <div className="is-due"><span>Request now</span><b>{money(due)}</b></div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
