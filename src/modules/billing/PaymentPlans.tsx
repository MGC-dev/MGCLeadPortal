import { useState } from 'react'
import { IconPlus, IconCalendarDue, IconEdit } from '@tabler/icons-react'
import { HeaderActions } from '../../shared/HeaderActions'
import { Tag, Sheet, SheetFoot, Field } from '../../shared/ui'
import { billingStore, useInvoices, usePlans } from './billingStore'
import type { PaymentPlan } from './types'
import './billing.css'

const fmt = (n: number, c: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n)
const dt = (n: number) => new Date(n).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
type Frequency = PaymentPlan['frequency']
type EditablePlan = Pick<PaymentPlan, 'name' | 'downPayment' | 'installmentAmount' | 'frequency' | 'startDate'>

export default function PaymentPlans() {
  const invoices = useInvoices()
  const plans = usePlans()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [invId, setInvId] = useState('')
  const [down, setDown] = useState('')
  const [installment, setInstallment] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('Monthly')
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10))

  const editingPlan = plans.find(x => x.id === editingId)
  const selectedInvoice = invoices.find(x => x.id === invId)
  const activeInvoice = editingPlan ? invoices.find(x => x.id === editingPlan.invoiceId) : selectedInvoice
  const numericDown = Number(down)
  const numericInstallment = Number(installment)
  const invalid = !name.trim() || !Number.isFinite(numericInstallment) || numericInstallment <= 0 ||
    !Number.isFinite(numericDown) || numericDown < 0 || !start ||
    (activeInvoice ? numericDown >= (editingPlan?.total ?? activeInvoice.balanceDue) : true)

  const resetForm = () => {
    setOpen(false)
    setEditingId(null)
    setName('')
    setInvId('')
    setDown('')
    setInstallment('')
    setFrequency('Monthly')
    setStart(new Date().toISOString().slice(0, 10))
  }

  const beginCreate = () => {
    resetForm()
    setOpen(true)
  }

  const beginEdit = (plan: PaymentPlan) => {
    setEditingId(plan.id)
    setName(plan.name)
    setInvId(plan.invoiceId)
    setDown(String(plan.downPayment))
    setInstallment(String(plan.installmentAmount))
    setFrequency(plan.frequency)
    setStart(new Date(plan.startDate).toISOString().slice(0, 10))
    setOpen(true)
  }

  const save = () => {
    const startDate = new Date(`${start}T12:00:00`).getTime()
    if (invalid) return
    if (editingPlan) {
      const updates: EditablePlan = {
        name: name.trim(),
        downPayment: numericDown,
        installmentAmount: numericInstallment,
        frequency,
        startDate,
      }
      billingStore.updatePlan(editingPlan.id, updates)
    } else {
      if (!selectedInvoice) return
      const plan: Omit<PaymentPlan, 'id' | 'createdBy'> = {
        name: name.trim() || `${selectedInvoice.customerName} payment plan`,
        customerName: selectedInvoice.customerName,
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.number,
        total: selectedInvoice.balanceDue,
        currency: selectedInvoice.currency,
        downPayment: numericDown,
        installmentAmount: numericInstallment,
        frequency,
        startDate,
        status: 'Active',
      }
      billingStore.createPlan(plan)
    }
    resetForm()
  }

  const title = editingPlan ? 'Edit payment plan' : 'Create payment plan'
  const helper = editingPlan
    ? 'Change the agreed terms. Paid history is retained and unpaid installments are rescheduled.'
    : 'Define an agreed schedule for an invoice balance.'

  return <div className="billing-page">
    <HeaderActions>
      <button className="btn btn--prominent" onClick={beginCreate}><IconPlus size={16} />Create payment plan</button>
    </HeaderActions>

    {/* <div className="billing-intro">
      <div><p className="footnote">Finance · Arrangements</p><h2>Payment plans</h2><p>Manage agreed payment schedules for clients with outstanding invoice balances.</p></div>
      <span className="billing-count">{plans.length} plans</span>
    </div> */}

    <div className="billing-detail-kpis">
      <div><span>Active plans</span><b>{plans.filter(x => x.status === 'Active').length}</b></div>
      <div><span>Completed</span><b>{plans.filter(x => x.status === 'Completed').length}</b></div>
      <div><span>Paused</span><b>{plans.filter(x => x.status === 'Paused').length}</b></div>
      <div><span>Plans with schedules</span><b>{plans.length}</b></div>
    </div>

    <div className="billing-panel">
      <div className="billing-panel__head"><div><h3>Payment arrangements</h3><p className="footnote">Plan terms and current status</p></div></div>
      <div className="billing-table-wrap"><table className="billing-table">
        <thead><tr><th>Plan</th><th>Customer</th><th>Invoice</th><th>Down payment</th><th>Installment</th><th>Frequency</th><th>Start date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{plans.map(plan => <tr key={plan.id}>
          <td><b>{plan.name}</b><small>{plan.id}</small></td>
          <td>{plan.customerName}</td><td>{plan.invoiceNumber}</td>
          <td>{fmt(plan.downPayment, plan.currency)}</td><td>{fmt(plan.installmentAmount, plan.currency)}</td>
          <td>{plan.frequency}</td><td>{dt(plan.startDate)}</td>
          <td><Tag tone={plan.status === 'Active' ? 'green' : 'tint'}>{plan.status}</Tag></td>
          <td><button className="btn btn--plain btn--sm billing-plan-edit" onClick={() => beginEdit(plan)} aria-label={`Edit ${plan.name}`}><IconEdit size={15} />Edit</button></td>
        </tr>)}</tbody>
      </table></div>
      {!plans.length && <p className="billing-empty">No payment plans have been created.</p>}
    </div>
    {/* <p className="billing-footnote">Changes to a plan keep paid installment records. Unpaid schedule rows are replaced with a new schedule based on the revised terms.</p> */}

    {open && <Sheet title={title} sub={helper} onClose={resetForm} foot={<SheetFoot onCancel={resetForm} primary={editingPlan ? 'Save changes' : 'Create plan'} disabled={invalid} />} onSubmit={e => { e.preventDefault(); save() }}>
      <div className="billing-form">
        <Field label="Plan name *" id="plan-name"><input id="plan-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Immigration case monthly plan" /></Field>
        <Field label="Invoice" id="plan-invoice">
          <select id="plan-invoice" value={invId} disabled={!!editingPlan} onChange={e => setInvId(e.target.value)}>
            <option value="">Choose an invoice</option>
            {invoices.filter(x => x.balanceDue > 0 || x.id === editingPlan?.invoiceId).map(x => <option key={x.id} value={x.id}>{x.number} · {x.customerName} · {fmt(x.balanceDue, x.currency)} due</option>)}
          </select>
        </Field>
        {activeInvoice && <div className="billing-payment-context"><span>{editingPlan ? 'Original plan amount' : 'Outstanding invoice balance'}</span><b>{fmt(editingPlan?.total ?? activeInvoice.balanceDue, activeInvoice.currency)}</b></div>}
        <div className="billing-form__two">
          <Field label="Down payment" id="plan-down"><input id="plan-down" type="number" min="0" step="0.01" value={down} onChange={e => setDown(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Installment amount *" id="plan-installment"><input id="plan-installment" type="number" min="0.01" step="0.01" value={installment} onChange={e => setInstallment(e.target.value)} placeholder="0.00" /></Field>
        </div>
        <div className="billing-form__two">
          <Field label="Payment frequency" id="plan-frequency"><select id="plan-frequency" value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}><option>Monthly</option><option>Biweekly</option><option>Weekly</option></select></Field>
          <Field label={editingPlan ? 'New schedule start date' : 'First payment date'} id="plan-start"><input id="plan-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></Field>
        </div>
        {activeInvoice && numericDown >= (editingPlan?.total ?? activeInvoice.balanceDue) && <p className="billing-error">The down payment must be less than the plan amount so installments can be scheduled.</p>}
        {editingPlan && <div className="billing-plan-warning"><IconCalendarDue size={17} /><span>Saving changes will remove the plan's old unpaid installment rows and create a new schedule. Completed and partially paid history will be retained.</span></div>}
      </div>
    </Sheet>}
  </div>
}
