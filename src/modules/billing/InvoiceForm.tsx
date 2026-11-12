import { useState } from 'react'
import type { Lead } from '../../api/types'
import { Sheet, SheetFoot, Field } from '../../shared/ui'
import type { BillingCurrency, InvoiceInput } from './types'
import './billing.css'

const today = () => new Date().toISOString().slice(0,10)
const dateValue = (s:string) => new Date(`${s}T12:00:00`).getTime()

export function InvoiceForm({ leads, onClose, onSave }: { leads: Lead[]; onClose:()=>void; onSave:(input:InvoiceInput)=>void }) {
  const [leadId,setLeadId] = useState('')
  const [customerName,setCustomerName] = useState('')
  const [customerEmail,setCustomerEmail] = useState('')
  const [invoiceDate,setInvoiceDate] = useState(today())
  const [dueDate,setDueDate] = useState(new Date(Date.now()+30*86400000).toISOString().slice(0,10))
  const [currency,setCurrency] = useState<BillingCurrency>('USD')
  const [description,setDescription] = useState('Professional services')
  const [quantity,setQuantity] = useState('1')
  const [unitPrice,setUnitPrice] = useState('')
  const [discount,setDiscount] = useState('0')
  const [taxRate,setTaxRate] = useState('0')
  const [notes,setNotes] = useState('')
  const [error,setError] = useState('')
  const subtotal = Math.max(0,Number(quantity)||0)*Math.max(0,Number(unitPrice)||0)
  const total = Math.max(0,subtotal-(Number(discount)||0))*(1+(Number(taxRate)||0)/100)
  const selectLead = (id:string) => { setLeadId(id); const l=leads.find(x=>x.id===id); if(l){setCustomerName(l.name);setCustomerEmail(l.email)} }
  const valid = !!customerName.trim() && !!description.trim() && Number(quantity)>0 && unitPrice.trim() !== '' && Number(unitPrice)>=0 && dueDate>=invoiceDate
  const submit = () => {
    if (!valid) { setError('Enter a customer, item description, positive quantity, valid amount and a due date on or after the invoice date.'); return }
    onSave({ customerName:customerName.trim(),customerEmail:customerEmail.trim(),relatedLeadId:leadId||undefined,invoiceDate:dateValue(invoiceDate),dueDate:dateValue(dueDate),currency,items:[{description:description.trim(),quantity:Number(quantity),unitPrice:Number(unitPrice)}],discount:Number(discount)||0,taxRate:Number(taxRate)||0,notes:notes.trim()||undefined })
  }
  return <Sheet wide title="Create invoice" sub="Add customer and billing details. This creates a local draft only." onClose={onClose} foot={<SheetFoot onCancel={onClose} primary="Create draft invoice" disabled={!valid}/> } onSubmit={e=>{e.preventDefault();submit()}}>
    <div className="billing-form">
      <div className="billing-form__section"><h3>Customer information</h3>
        <Field label="Select CRM lead (optional)" id="invoice-lead"><select id="invoice-lead" value={leadId} onChange={e=>selectLead(e.target.value)}><option value="">Choose a lead or enter manually</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name} · {l.matter}</option>)}</select></Field>
        <div className="billing-form__two">
          <Field label="Customer name" id="invoice-customer"><input id="invoice-customer" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer / client name" required/></Field>
          <Field label="Email address" id="invoice-email"><input id="invoice-email" type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="name@example.com"/></Field>
        </div>
      </div>
      <div className="billing-form__section"><h3>Invoice details</h3>
        <div className="billing-form__three">
          <Field label="Invoice date" id="invoice-date"><input id="invoice-date" type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></Field>
          <Field label="Due date" id="invoice-due"><input id="invoice-due" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Field>
          <Field label="Currency" id="invoice-currency"><select id="invoice-currency" value={currency} onChange={e=>setCurrency(e.target.value as BillingCurrency)}>{['USD','INR','EUR','GBP','CAD','AUD'].map(c=><option key={c}>{c}</option>)}</select></Field>
        </div>
      </div>
      <div className="billing-form__section"><h3>Invoice item</h3>
        <Field label="Description" id="invoice-item"><input id="invoice-item" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Service or product description"/></Field>
        <div className="billing-form__three">
          <Field label="Quantity" id="invoice-qty"><input id="invoice-qty" type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field>
          <Field label="Unit price" id="invoice-price"><input id="invoice-price" type="number" min="0" step="0.01" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} placeholder="0.00"/></Field>
          <Field label="Discount" id="invoice-discount"><input id="invoice-discount" type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></Field>
        </div>
        <Field label="Tax rate (%)" id="invoice-tax"><input id="invoice-tax" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e=>setTaxRate(e.target.value)}/></Field>
        <div className="billing-form__total"><span>Estimated total</span><b>{currency} {total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>
      </div>
      <div className="billing-form__section"><h3>Additional notes</h3><Field label="Notes (optional)" id="invoice-notes"><textarea id="invoice-notes" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Payment instructions or notes for the customer"/></Field></div>
      {error && <p className="billing-error">{error}</p>}
      <p className="billing-form__hint">Amounts are entered in the selected currency. Tax rules and invoice numbering will be configured in the backend phase.</p>
    </div>
  </Sheet>
}
