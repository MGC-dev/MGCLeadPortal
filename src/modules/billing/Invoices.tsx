import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconSearch,IconArrowLeft } from '@tabler/icons-react'
import { HeaderActions } from '../../shared/HeaderActions'
import { FilterMenu, ExpandingSearch } from '../../shared/HeaderTools'
import { Tag } from '../../shared/ui'
import { money } from '../../shared/format'
import { leadsApi, useQuery } from '../../api'
import { billingStore, useInvoices } from './billingStore'
import type { Invoice, InvoiceInput, InvoiceStatus } from './types'
import { InvoiceForm } from './InvoiceForm'
import './billing.css'

const statusLabel: Record<InvoiceStatus, string> = { draft:'Draft', sent:'Sent', partially_paid:'Partially paid', paid:'Paid', overdue:'Overdue', void:'Void' }
const tone: Record<InvoiceStatus, 'tint'|'green'|'orange'|'red'> = { draft:'tint', sent:'tint', partially_paid:'orange', paid:'green', overdue:'red', void:'tint' }
const amountLabel = (n:number, currency:string) => new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(n)
const dateLabel = (n:number) => new Date(n).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})

export default function Invoices() {
  const invoices = useInvoices()
  const leads = useQuery(() => leadsApi.list()) ?? []
  const navigate = useNavigate()
  const [status,setStatus] = useState('all')
  const [q,setQ] = useState('')
  const [creating,setCreating] = useState(false)
  const term = q.trim().toLowerCase()
  const rows = useMemo(() => invoices.filter(x => (status === 'all' || x.status === status) && (!term || `${x.number} ${x.customerName} ${x.customerEmail}`.toLowerCase().includes(term))).sort((a,b)=>b.createdAt-a.createdAt),[invoices,status,term])
  const create = (input: InvoiceInput) => { const invoice = billingStore.create(input); setCreating(false); navigate(`/billing/invoices/${invoice.id}`) }
  return <div className="billing-page">
    <HeaderActions>
      <button className="btn btn--prominent" type="button" onClick={() => setCreating(true)}><IconPlus size={16}/>New invoice</button>
      <ExpandingSearch value={q} onChange={setQ}/>
      <FilterMenu label="Filter invoices" activeLabel="Filters applied" sections={[{title:'Status',value:status,onChange:setStatus,options:[{value:'all',label:'All statuses',badge:null},...Object.entries(statusLabel).map(([value,label])=>({value,label,badge:null}))]}]}/>
    </HeaderActions>
    <div className="billing-intro"><div><p className="footnote"><button type="button" className="docv__back" onClick={() => navigate('/billing')}><IconArrowLeft size={16} stroke={2.2} />Billing & Payments</button></p><h2>Invoices</h2><p>Create invoices and follow payment progress for each customer.</p></div><span className="billing-count">{rows.length} records</span></div>
    <section className="billing-panel">
      {rows.length ? <div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Invoice date</th><th>Due date</th><th>Total</th><th>Balance due</th><th>Status</th></tr></thead><tbody>
        {rows.map(inv=><tr key={inv.id} onClick={()=>navigate(`/billing/invoices/${inv.id}`)}><td><b>{inv.number}</b></td><td>{inv.customerName}<small>{inv.customerEmail}</small></td><td>{dateLabel(inv.invoiceDate)}</td><td>{dateLabel(inv.dueDate)}</td><td><b>{amountLabel(inv.total,inv.currency)}</b></td><td>{amountLabel(inv.balanceDue,inv.currency)}</td><td><Tag tone={tone[inv.status]}>{statusLabel[inv.status]}</Tag></td></tr>)}
      </tbody></table></div> : <div className="billing-empty"><IconSearch size={24}/><b>No invoices found</b><span>Try changing your search or filters, or create a new invoice.</span></div>}
    </section>
    <p className="billing-footnote">Demo mode: records are stored in this browser's local storage, not sent to a server.</p>
    {creating && <InvoiceForm leads={leads} onClose={()=>setCreating(false)} onSave={create}/>}
  </div>
}
