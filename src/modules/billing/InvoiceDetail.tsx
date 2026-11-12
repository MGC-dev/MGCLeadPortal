import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconPrinter } from '@tabler/icons-react'
import { billingStore, useInvoices } from './billingStore'
import { Tag } from '../../shared/ui'
import type { InvoiceStatus } from './types'
import './billing.css'

const labels:Record<InvoiceStatus,string>={draft:'Draft',sent:'Sent',partially_paid:'Partially paid',paid:'Paid',overdue:'Overdue',void:'Void'}
const tones:Record<InvoiceStatus,'tint'|'green'|'orange'|'red'>={draft:'tint',sent:'tint',partially_paid:'orange',paid:'green',overdue:'red',void:'tint'}
const amount=(n:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(n)
const date=(n:number)=>new Date(n).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
export default function InvoiceDetail(){
  const {id=''}=useParams(); const navigate=useNavigate(); useInvoices()
  const invoice=billingStore.getById(id)
  if(!invoice)return <div className="billing-page"><button className="btn" onClick={()=>navigate('/billing/invoices')}><IconArrowLeft size={16}/> Back to invoices</button><p className="billing-empty">Invoice not found.</p></div>
  return <div className="billing-page">
    <div className="billing-detail-actions"><button className="btn btn--plain" onClick={()=>navigate('/billing/invoices')}><IconArrowLeft size={16}/>Invoices</button><button className="btn" onClick={()=>window.print()}><IconPrinter size={16}/>Print preview</button></div>
    <section className="billing-panel billing-invoice-paper">
      <div className="billing-invoice-head"><div><span className="billing-brand">MGC CRM</span><h2>INVOICE</h2><p>{invoice.number}</p></div><Tag tone={tones[invoice.status]}>{labels[invoice.status]}</Tag></div>
      <div className="billing-invoice-meta"><div><small>Bill to</small><b>{invoice.customerName}</b><span>{invoice.customerEmail}</span></div><div><small>Invoice date</small><b>{date(invoice.invoiceDate)}</b><small>Due date</small><b>{date(invoice.dueDate)}</b></div></div>
      <div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{invoice.items.map(item=><tr key={item.id}><td>{item.description}</td><td>{item.quantity}</td><td>{amount(item.unitPrice,invoice.currency)}</td><td><b>{amount(item.quantity*item.unitPrice,invoice.currency)}</b></td></tr>)}</tbody></table></div>
      <div className="billing-invoice-totals"><div><span>Subtotal</span><b>{amount(invoice.subtotal,invoice.currency)}</b></div><div><span>Discount</span><b>-{amount(invoice.discount,invoice.currency)}</b></div><div><span>Tax ({invoice.taxRate}%)</span><b>{amount(invoice.taxAmount,invoice.currency)}</b></div><div className="is-total"><span>Total</span><b>{amount(invoice.total,invoice.currency)}</b></div><div><span>Amount paid</span><b>{amount(invoice.amountPaid,invoice.currency)}</b></div><div className="is-balance"><span>Balance due</span><b>{amount(invoice.balanceDue,invoice.currency)}</b></div></div>
      {invoice.notes&&<div className="billing-invoice-notes"><small>Notes</small><p>{invoice.notes}</p></div>}
    </section>
    <p className="billing-footnote">Frontend preview only. Printing uses your browser. No invoice has been emailed or posted to an accounting system.</p>
  </div>
}
