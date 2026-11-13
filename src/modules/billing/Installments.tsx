import{useInstallments}from'./billingStore';import{Tag}from'../../shared/ui';import{IconCalendarDue}from'@tabler/icons-react';import'./billing.css'
const dt=(n:number)=>new Date(n).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});const fmt=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n)
export default function Installments(){
    const rows=useInstallments();
    return <div className="billing-page">
       {/* <div className="billing-intro">
            <div>
                 <p className="footnote">Finance · Scheduled collections</p>
                <h2>Installments</h2> 
                <p>Track individual scheduled amounts and their due dates across payment plans.</p>
            </div>
            <span className="billing-count">{rows.length} installments</span>
        </div> */}
        {/* <div className="billing-detail-kpis">
            <div>
                <span>Total scheduled</span><b>{fmt(rows.reduce((s,x)=>s+x.amount,0))}</b>
            </div>
            <div>
                <span>Paid</span><b>{fmt(rows.reduce((s,x)=>s+x.paid,0))}</b>
            </div>
            <div>
                <span>Upcoming</span><b>{rows.filter(x=>x.status==='Upcoming').length}</b>
            </div>
            <div>
                <span>Overdue</span><b>{rows.filter(x=>x.status==='Overdue').length}</b>
            </div>
        </div>
        <div className="billing-panel">
            <div className="billing-panel__head">
                <div>
                    <h3>Installment schedule</h3>
                    <p className="footnote">Due dates, expected amounts and payment progress</p>
                </div>
            </div>
            <div className="billing-table-wrap">
                <table className="billing-table">
                    <thead>
                        <tr>
                            <th>Installment</th>
                            <th>Customer</th>
                            <th>Invoice</th>
                            <th>Due date</th>
                            <th>Amount due</th>
                            <th>Paid</th>
                            <th>Remaining</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((x,i)=><tr key={x.id}><td><b>INST-{String(i+1).padStart(4,'0')}</b></td><td>{x.customerName}</td><td>{x.invoiceNumber}</td><td>{dt(x.dueDate)}</td><td>{fmt(x.amount)}</td><td>{fmt(x.paid)}</td><td><b>{fmt(Math.max(0,x.amount-x.paid))}</b></td><td><Tag tone={x.status==='Paid'?'green':x.status==='Overdue'?'red':x.status==='Due'?'orange':'tint'}>{x.status}</Tag></td></tr>)}
                    </tbody>
                </table>
            </div>
            {!rows.length&&<p className="billing-empty">No installments scheduled yet. Create a payment plan to begin.</p>}
        </div>
    </div>} */}
 <div className="billing-detail-kpis">
                    <div>
                        <span>Total scheduled</span><b>{fmt(rows.reduce((s,x)=>s+x.amount,0))}</b>
                    </div>
                    <div>
                        <span>Paid</span><b>{fmt(rows.reduce((s,x)=>s+x.paid,0))}</b>
                    </div>
                    <div>
                        <span>Upcoming</span><b>{rows.filter(x=>x.status==='Upcoming').length}</b>
                    </div>
                    <div>
                        <span>Overdue</span><b>{rows.filter(x=>x.status==='Overdue').length}</b>
                    </div>
                </div>
                <div className="billing-panel">
                    <div className="billing-panel__head">
                        <div><h3>Installment schedule</h3>
                        <p className="footnote">Due dates, expected amounts and payment progress</p>
                        </div>
                    </div>
                    <div className="billing-table-wrap">
                        <table className="billing-table">
                            <thead><tr><th>Installment</th><th>Customer</th><th>Invoice</th><th>Due date</th><th>Amount due</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{rows.map((x,i)=><tr key={x.id}><td><b>INST-{String(i+1).padStart(4,'0')}</b></td><td>{x.customerName}</td><td>{x.invoiceNumber}</td><td>{dt(x.dueDate)}</td><td>{fmt(x.amount)}</td><td>{fmt(x.paid)}</td><td><b>{fmt((x.status==='Rescheduled'?0:Math.max(0,x.amount-x.paid)))}</b></td><td><Tag tone={x.status==='Paid'?'green':x.status==='Overdue'?'red':x.status==='Due'?'orange':x.status==='Rescheduled'?'tint':'tint'}>{x.status}</Tag></td></tr>)}</tbody>
                            
                        </table>
                    </div>{!rows.length&&<p className="billing-empty">No installments scheduled yet. Create a payment plan to begin.</p>}
                    
                </div>
                {/* <p className="billing-footnote">Sample installment schedule only. Installment generation, rescheduling, reminders and collection actions will be implemented with backend rules.</p> */}
                
            </div>}