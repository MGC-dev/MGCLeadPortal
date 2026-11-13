import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowUpRight, IconFileInvoice, IconWallet, IconClock, IconAlertTriangle, IconPlus } from '@tabler/icons-react'
import { HeaderActions } from '../../shared/HeaderActions'
import { Tag } from '../../shared/ui'
import { money } from '../../shared/format'
import { useInvoices } from './billingStore'
import type { Invoice } from './types'
import './billing.css'

const statusLabel: Record<Invoice['status'], string> = {
  draft: 'Draft', sent: 'Sent', partially_paid: 'Partially paid', paid: 'Paid', overdue: 'Overdue', void: 'Void',
}
const statusTone: Record<Invoice['status'], 'tint' | 'green' | 'orange' | 'red'> = {
  draft: 'tint', sent: 'tint', partially_paid: 'orange', paid: 'green', overdue: 'red', void: 'tint',
}
const dateLabel = (n: number) => new Date(n).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function BillingDashboard() {
  const invoices = useInvoices()
  const navigate = useNavigate()
  const totals = useMemo(() => ({
    invoiced: invoices.filter(x => x.status !== 'void').reduce((s, x) => s + x.total, 0),
    collected: invoices.reduce((s, x) => s + x.amountPaid, 0),
    outstanding: invoices.reduce((s, x) => s + x.balanceDue, 0),
    overdue: invoices.filter(x => x.status === 'overdue').reduce((s, x) => s + x.balanceDue, 0),
  }), [invoices])
  const recent = [...invoices].sort((a,b) => b.createdAt-a.createdAt).slice(0,5)
  const max = Math.max(totals.invoiced, totals.collected, 1)
  const cards = [
    { label: 'Total invoiced', value: money(totals.invoiced), note: `${invoices.length} invoices`, icon: <IconFileInvoice /> },
    { label: 'Collected', value: money(totals.collected), note: totals.invoiced ? `${Math.round(totals.collected / totals.invoiced * 100)}% of invoiced` : 'No collections yet', icon: <IconWallet /> },
    { label: 'Outstanding', value: money(totals.outstanding), note: 'Remaining balance', icon: <IconClock /> },
    { label: 'Overdue', value: money(totals.overdue), note: `${invoices.filter(x => x.status === 'overdue').length} overdue invoices`, icon: <IconAlertTriangle /> },
  ]
  return (
    <div className="billing-page">
      <HeaderActions>
        <button className="btn btn--prominent" type="button" onClick={() => navigate('/billing/invoices/new')}><IconPlus size={16} />New invoice</button>
      </HeaderActions>
      {/* <div className="billing-intro">
        <div><p>Track invoices, collections and outstanding balances across your organization.</p></div>
      </div> */}
      <div className="billing-kpis">
        {cards.map(c => <section className="billing-kpi" key={c.label}><span className="billing-kpi__icon">{c.icon}</span><span className="billing-kpi__label">{c.label}</span><b>{c.value}</b><small>{c.note}</small></section>)}
      </div>
      <div className="billing-grid">
        <section className="billing-panel">
          <div className="billing-panel__head"><div><h3>Invoice collection</h3><p className="footnote">Collected amount compared with total invoiced</p></div></div>
          <div className="billing-progress">
            <div className="billing-progress__labels"><span>Collected</span><b>{money(totals.collected)}</b></div>
            <div className="billing-progress__track"><span style={{ width: `${Math.min(100, totals.collected / max * 100)}%` }} /></div>
            <div className="billing-progress__labels"><span>Outstanding</span><b>{money(totals.outstanding)}</b></div>
            <div className="billing-progress__track billing-progress__track--muted"><span style={{ width: `${Math.min(100, totals.outstanding / max * 100)}%` }} /></div>
          </div>
          <div className="billing-breakdown"><span><i className="billing-dot billing-dot--paid" />Collected</span><span><i className="billing-dot billing-dot--due" />Outstanding</span></div>
        </section>
        <section className="billing-panel">
          <div className="billing-panel__head"><div><h3>Invoice status</h3><p className="footnote">Current invoice distribution</p></div></div>
          {(['paid','sent','partially_paid','overdue','draft'] as const).map(status => {
            const count = invoices.filter(x => x.status === status).length
            return <div className="billing-status-row" key={status}><span>{statusLabel[status]}</span><span className="billing-status-row__track"><i style={{ width: `${invoices.length ? count / invoices.length * 100 : 0}%` }} /></span><b>{count}</b></div>
          })}
        </section>
      </div>
      <section className="billing-panel billing-recent">
        <div className="billing-panel__head"><div><h3>Recent invoices</h3><p className="footnote">The latest invoice activity</p></div><button className="btn btn--plain btn--sm" type="button" onClick={() => navigate('/billing/invoices')}>View all <IconArrowUpRight size={15}/></button></div>
        {recent.length ? <div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          {recent.map(inv => <tr key={inv.id} onClick={() => navigate(`/billing/invoices/${inv.id}`)}><td><b>{inv.number}</b></td><td>{inv.customerName}<small>{inv.customerEmail}</small></td><td>{dateLabel(inv.dueDate)}</td><td><b>{money(inv.total)}</b></td><td><Tag tone={statusTone[inv.status]}>{statusLabel[inv.status]}</Tag></td></tr>)}
        </tbody></table></div> : <p className="billing-empty">No invoices have been created.</p>}
      </section>
      {/* <p className="billing-footnote">This is a frontend demonstration. Invoice and payment figures are sample data saved in this browser only.</p> */}
    </div>
  )
}
