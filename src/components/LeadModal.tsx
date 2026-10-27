import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { documents as docApi, invoices as invApi, leads as api, services as serviceApi } from '../api'
import { useQuery } from '../hooks'
import { ATTORNEYS, ENGAGEMENT_KINDS, LEAD_STAGES, SOURCES, type Lead, type LeadStatus, type Service } from '../types'
import { Button, Input, Label, Modal, Select, StatusBadge, Textarea } from './ui'
import { ContactPanel } from './contacts'
import { estimatedValue, money, priceLabel } from '../format'

/** Grouped by practice area; only active services can be picked for new intakes. */
function ServiceSelect({ services, value, onChange, required }: { services?: Service[]; value: string; onChange: (id: string) => void; required?: boolean }) {
  const areas = [...new Set((services ?? []).map(s => s.practiceArea))]
  return (
    <Select required={required} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select a service…</option>
      {areas.map(a => (
        <optgroup key={a} label={a}>
          {services!.filter(s => s.practiceArea === a).map(s => <option key={s.id} value={s.id}>{s.name} · {priceLabel(s)}</option>)}
        </optgroup>
      ))}
    </Select>
  )
}

export function AddLead({ onClose }: { onClose: () => void }) {
  const services = useQuery(() => serviceApi.list())
  const active = services?.filter(s => s.active)
  const [f, setF] = useState({ name: '', email: '', phone: '', source: SOURCES[0], serviceId: '', practiceArea: '', value: 0, assignedTo: ATTORNEYS[0], notes: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === 'value' ? Number(e.target.value) : e.target.value })
  const service = services?.find(s => s.id === f.serviceId)
  const pick = (id: string) => {
    const s = services?.find(x => x.id === id)
    setF({ ...f, serviceId: id, practiceArea: s?.practiceArea ?? '', value: (s && estimatedValue(s)) ?? f.value })
  }
  return (
    <Modal title="New lead" onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.create(f); onClose() }}>
        <Label label="Full name"><Input required value={f.name} onChange={set('name')} /></Label>
        <div className="grid grid-cols-2 gap-3">
          <Label label="Email"><Input required type="email" value={f.email} onChange={set('email')} /></Label>
          <Label label="Phone"><Input value={f.phone} onChange={set('phone')} /></Label>
          <Label label="Source"><Select value={f.source} onChange={set('source')}>{SOURCES.map(p => <option key={p}>{p}</option>)}</Select></Label>
          <Label label="Estimated value ($)"><Input type="number" min={0} value={f.value} onChange={set('value')} /></Label>
          <Label label="Assigned to"><Select value={f.assignedTo} onChange={set('assignedTo')}>{ATTORNEYS.map(p => <option key={p}>{p}</option>)}</Select></Label>
        </div>
        <Label label="Service"><ServiceSelect required services={active} value={f.serviceId} onChange={pick} /></Label>
        {service && (
          <p className="rounded-lg bg-brand-50 p-3 text-xs text-slate-600">
            <strong>{service.practiceArea}</strong> · {priceLabel(service)}{service.retainer ? ` · ${money(service.retainer)} retainer` : ''}
            {service.pricingModel === 'contingency' && ' · enter the expected fee as the estimated value'}
          </p>
        )}
        <Label label="Notes"><Textarea value={f.notes} onChange={set('notes')} /></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Create lead</Button></div>
      </form>
    </Modal>
  )
}

/** Lead details. Retaining a lead always goes through the convert step, which creates the client. */
export function LeadModal({ lead, onClose, startConverting = false }: { lead: Lead; onClose: () => void; startConverting?: boolean }) {
  const nav = useNavigate()
  const [converting, setConverting] = useState(startConverting)
  const services = useQuery(() => serviceApi.list())
  const service = services?.find(s => s.id === lead.serviceId)
  const docs = useQuery(() => docApi.list())
  const invs = useQuery(() => invApi.list())
  const engagement = docs?.find(d => d.leadId === lead.id && ENGAGEMENT_KINDS.includes(d.kind))
  const retainerInv = invs?.find(i => i.leadId === lead.id && i.type === 'retainer')
  const [matterEdit, setMatter] = useState<string>()
  const [retainerEdit, setRetainer] = useState<number>()
  const matter = matterEdit ?? `${service?.name ?? lead.practiceArea} – ${lead.name}`
  const defaultRetainer = service?.retainer ?? Math.round(lead.value * 0.25 / 100) * 100
  const retainer = retainerEdit ?? defaultRetainer
  const retained = lead.status === 'retained'
  const ready = engagement?.status === 'signed' && retainerInv?.status === 'paid'

  const sendEngagement = async () => {
    const d = engagement ?? await docApi.create({ name: `Engagement Letter – ${lead.name}`, kind: 'Engagement Letter', recipientName: lead.name, recipientEmail: lead.email, leadId: lead.id })
    await docApi.send(d.id)
  }
  const sendPaymentLink = async () => {
    const i = retainerInv ?? await invApi.create({ leadId: lead.id, type: 'retainer', description: `Retainer – ${service?.name ?? lead.practiceArea}`, amount: defaultRetainer, dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString() })
    await invApi.send(i.id)
  }

  if (converting && !retained) {
    return (
      <Modal title={`Retain ${lead.name} as a client`} onClose={onClose}>
        <p className="mb-4 text-sm text-slate-600">This creates the client record and a matter, a draft retainer agreement (for e-signature), and a draft retainer invoice.</p>
        <div className="space-y-3">
          <Label label="Matter title"><Input value={matter} onChange={e => setMatter(e.target.value)} /></Label>
          {retainerInv
            ? <p className="text-sm text-slate-600">Retainer invoice <strong>{retainerInv.number}</strong> ({money(retainerInv.amount)}) and the engagement letter will move to the client.</p>
            : <Label label="Retainer amount ($)"><Input type="number" min={0} value={retainer} onChange={e => setRetainer(Number(e.target.value))} /></Label>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => (startConverting ? onClose() : setConverting(false))}>{startConverting ? 'Cancel' : 'Back'}</Button>
          <Button onClick={async () => { const c = await api.convert(lead.id, { matterTitle: matter, retainerAmount: retainer }); onClose(); nav(`/clients/${c.id}`) }}>Convert to client</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={lead.name} onClose={onClose} wide>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {([['Email', lead.email], ['Phone', lead.phone], ['Practice area', lead.practiceArea], ['Source', lead.source], ['Est. value', money(lead.value)], ['Owner', lead.assignedTo]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-900">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{lead.notes || 'No notes.'}</p>
      <div className="mt-4">
        <Label label={service ? `Service · ${priceLabel(service)}` : 'Service'}>
          <ServiceSelect services={services?.filter(s => s.active || s.id === lead.serviceId)} value={lead.serviceId ?? ''}
            onChange={id => { const s = services?.find(x => x.id === id); if (s) api.update(lead.id, { serviceId: id, practiceArea: s.practiceArea }) }} />
        </Label>
      </div>
      {!retained && (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Engagement & payment</p>
          <div className="flex items-center justify-between">
            <span>Engagement letter {engagement && <StatusBadge status={engagement.status} />}</span>
            {(!engagement || engagement.status === 'draft') && <Button size="sm" variant="secondary" onClick={sendEngagement}>Send for signature</Button>}
          </div>
          <div className="flex items-center justify-between">
            <span>Retainer {retainerInv ? <>{money(retainerInv.amount)} <StatusBadge status={retainerInv.status} /></> : defaultRetainer <= 0 && <span className="text-xs text-slate-400">none for this service</span>}</span>
            <span className="flex gap-1.5">
              {(!retainerInv || retainerInv.status === 'draft') && defaultRetainer > 0 && <Button size="sm" variant="secondary" onClick={sendPaymentLink}>Send payment link</Button>}
              {retainerInv && retainerInv.status !== 'paid' && retainerInv.status !== 'draft' && <Button size="sm" variant="secondary" onClick={() => invApi.markPaid(retainerInv.id)}>Record payment</Button>}
            </span>
          </div>
          {ready && <p className="rounded bg-emerald-50 p-2 text-xs text-emerald-700">Engagement signed and retainer paid. Ready to retain as a client.</p>}
        </div>
      )}
      <div className="mt-4"><Label label="Stage">
        <Select value={lead.status} disabled={retained}
          onChange={e => (e.target.value === 'retained' ? setConverting(true) : api.moveTo(lead.id, e.target.value as LeadStatus))}>
          {LEAD_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select></Label></div>
      <div className="mt-4 border-t border-slate-100 pt-4"><ContactPanel {...(lead.clientId ? { clientId: lead.clientId, leadId: lead.id } : { leadId: lead.id })} /></div>
      <div className="mt-5 flex justify-between">
        {retained ? <span /> : <Button variant="danger" onClick={async () => { if (confirm('Delete this lead?')) { await api.remove(lead.id); onClose() } }}>Delete</Button>}
        {retained && lead.clientId ? <Button onClick={() => { onClose(); nav(`/clients/${lead.clientId}`) }}>View client →</Button>
          : <Button onClick={() => setConverting(true)}>Retain as client</Button>}
      </div>
    </Modal>
  )
}
