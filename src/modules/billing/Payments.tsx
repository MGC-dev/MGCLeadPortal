import {useMemo,useState} from 'react';
import{useSearchParams}from'react-router-dom';
import{IconPlus,IconCreditCard}from'@tabler/icons-react';
import{HeaderActions}from'../../shared/HeaderActions';
import{Tag,Sheet,SheetFoot,Field}from'../../shared/ui';
import{billingStore,useInvoices,usePayments}from'./billingStore';
import type{PaymentStatus}from'./types';
import'./billing.css'
const fmt=(n:number,c:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n);
const dt=(n:number)=>new Date(n).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const tone:Record<PaymentStatus,'green'|'orange'|'red'|'tint'>={completed:'green',pending:'orange',failed:'red',refunded:'tint'}
export default function Payments(){
    const invoices=useInvoices();
    const payments=usePayments();
    const[params]=useSearchParams();
    const[open,setOpen]=useState(false);
    const[invId,setInvId]=useState(params.get('invoice')??'');
    const[date,setDate]=useState(new Date().toISOString().slice(0,10));
    const[method,setMethod]=useState<'Card'|'Bank transfer'|'Check'|'Cash'|'Other'>('Card');
    const[amount,setAmount]=useState('');
    const[transaction,setTransaction]=useState('');
    const[note,setNote]=useState('');
    const[selected,setSelected]=useState('all');
    const invoice=invoices.find(x=>x.id===invId);
    const rows=useMemo(()=>payments.filter(p=>selected==='all'||p.status===selected),[payments,selected]);
    const save=()=>{if(!invoice||Number(amount)<=0||Number(amount)>invoice.balanceDue)return;billingStore.addPayment({invoiceId:invId,date:new Date(`${date}T12:00:00`).getTime(),method,amount:Number(amount),status:'completed',transactionId:transaction||undefined,note:note||undefined});setOpen(false);setAmount('');setTransaction('');setNote('')};
    return <div className="billing-page">
        <HeaderActions>
            <button className="btn btn--prominent" onClick={()=>setOpen(true)}><IconPlus size={16}/>Record payment</button>
        </HeaderActions>
       {/* <div className="billing-intro">
            <div>
                 <p className="footnote">Finance · Transactions</p>
                <h2>Payments</h2> 
                <p>Record and review payments received against client invoices.</p>
            </div>
            <span className="billing-count">{payments.length} transactions</span>
        </div>*/}
        <div className="billing-detail-kpis">
            <div><span>Total received</span>
            <b>{fmt(payments.filter(x=>x.status==='completed').reduce((s,x)=>s+x.amount,0),'USD')}</b>
            </div>
            <div><span>Completed</span>
            <b>{payments.filter(x=>x.status==='completed').length}</b>
            </div>
            <div><span>Pending</span>
            <b>{payments.filter(x=>x.status==='pending').length}</b>
            </div>
            <div><span>Failed / refunded</span>
            <b>{payments.filter(x=>x.status==='failed'||x.status==='refunded').length}</b>
            </div>
        </div>
        <div className="billing-panel">
            <div className="billing-panel__head">
                <div><h3>Payment transactions</h3>
                <p className="footnote">Manual entries and gateway transactions</p>
                </div>
                <select className="billing-inline-select" value={selected} onChange={e=>setSelected(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                </select>
            </div>
            <div className="billing-table-wrap">
                <table className="billing-table">
                    <thead><tr><th>Payment ref.</th><th>Invoice</th><th>Customer</th><th>Date</th><th>Method</th><th>Transaction ID</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>{rows.map(p=><tr key={p.id}><td><b>{p.reference}</b></td><td>{p.invoiceNumber}</td><td>{p.customerName}</td><td>{dt(p.date)}</td><td>{p.method}</td><td>{p.transactionId||'—'}</td><td><b>{fmt(p.amount,p.currency)}</b></td><td><Tag tone={tone[p.status]}>{p.status}</Tag></td></tr>)}</tbody>
                </table>
            </div>{!rows.length&&<p className="billing-empty">No payment records found.</p>}
        </div>
        {/* <p className="billing-footnote">Frontend demo only. Recording a payment updates the local invoice balance; it does not charge a card or connect to a payment gateway.</p> */}
{open&&<Sheet title="Record a payment" sub="Add a payment received from a client. This does not initiate a charge." onClose={()=>setOpen(false)} foot={<SheetFoot onCancel={()=>setOpen(false)} primary="Save payment" disabled={!invoice||!(Number(amount)>0)||Number(amount)>(invoice?.balanceDue??0)}/>} onSubmit={e=>{e.preventDefault();save()}}><div className="billing-form"><Field label="Invoice *" id="payment-invoice"><select id="payment-invoice" value={invId} onChange={e=>{setInvId(e.target.value);setAmount('')}}><option value="">Select invoice</option>{invoices.filter(x=>x.balanceDue>0).map(x=><option key={x.id} value={x.id}>{x.number} · {x.customerName} · Due {fmt(x.balanceDue,x.currency)}</option>)}</select></Field>{invoice&&<div className="billing-payment-context"><span>Outstanding balance</span><b>{fmt(invoice.balanceDue,invoice.currency)}</b></div>}<div className="billing-form__two"><Field label="Payment date *" id="payment-date"><input id="payment-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Amount received *" id="payment-amount"><input id="payment-amount" type="number" min="0.01" max={invoice?.balanceDue} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></Field></div><div className="billing-form__two"><Field label="Payment method" id="payment-method"><select id="payment-method" value={method} onChange={e=>setMethod(e.target.value as typeof method)}>{['Card','Bank transfer','Check','Cash','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Transaction / reference ID" id="payment-ref"><input id="payment-ref" value={transaction} onChange={e=>setTransaction(e.target.value)} placeholder="Optional reference"/></Field></div><Field label="Internal note" id="payment-note"><textarea id="payment-note" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note"/></Field>{invoice&&Number(amount)>invoice.balanceDue&&<p className="billing-error">Payment cannot exceed the current outstanding balance.</p>}</div></Sheet>}
</div>}
