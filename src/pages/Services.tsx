import { useState } from 'react'
import { leads as leadApi, services as api } from '../api'
import { useQuery } from '../hooks'
import { PRACTICE_AREAS, PRICING_MODELS, type PricingModel, type Service } from '../types'
import { Badge, Button, Card, Input, Label, Modal, PageHeader, Select, Table, Td, Textarea } from '../components/ui'
import { money, priceLabel } from '../format'

export default function Services() {
  const list = useQuery(() => api.list())
  const leads = useQuery(() => leadApi.list())
  const [editing, setEditing] = useState<Service | 'new'>()
  const [area, setArea] = useState('')
  const rows = (list ?? []).filter(s => !area || s.practiceArea === area)
  const uses = (id: string) => leads?.filter(l => l.serviceId === id).length ?? 0

  return (
    <>
      <PageHeader title="Services" subtitle="The catalog your team selects from during intake"
        actions={<>
          <Select value={area} onChange={e => setArea(e.target.value)} className="!w-48"><option value="">All practice areas</option>{PRACTICE_AREAS.map(p => <option key={p}>{p}</option>)}</Select>
          <Button onClick={() => setEditing('new')}>+ New service</Button>
        </>} />
      <Card>
        <Table head={['Service', 'Practice area', 'Pricing', 'Retainer', 'Leads', 'Status', '']} empty={rows.length ? undefined : 'No services'}>
          {rows.map(s => (
            <tr key={s.id} className={s.active ? '' : 'opacity-60'}>
              <Td><span className="font-medium text-slate-900">{s.name}</span><br /><span className="text-xs text-slate-500">{s.description}</span></Td>
              <Td>{s.practiceArea}</Td>
              <Td><span className="font-medium">{priceLabel(s)}</span><br /><span className="text-xs text-slate-500">{PRICING_MODELS[s.pricingModel]}</span></Td>
              <Td>{s.retainer ? money(s.retainer) : '—'}</Td>
              <Td>{uses(s.id)}</Td>
              <Td><Badge tone={s.active ? 'green' : 'gray'}>{s.active ? 'active' : 'inactive'}</Badge></Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Edit</Button>{' '}
                <Button size="sm" variant="ghost" onClick={() => api.update(s.id, { active: !s.active })}>{s.active ? 'Deactivate' : 'Activate'}</Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing && <ServiceForm service={editing === 'new' ? undefined : editing} inUse={editing !== 'new' && uses(editing.id) > 0} onClose={() => setEditing(undefined)} />}
    </>
  )
}

function ServiceForm({ service, inUse, onClose }: { service?: Service; inUse: boolean; onClose: () => void }) {
  const [f, setF] = useState<Omit<Service, 'id'>>(service ?? { name: '', practiceArea: PRACTICE_AREAS[0], description: '', pricingModel: 'flat', price: 0, retainer: 0, active: true })
  const unit = { flat: 'Fee ($)', hourly: 'Hourly rate ($)', monthly: 'Monthly fee ($)', contingency: 'Contingency (%)' }[f.pricingModel]
  return (
    <Modal title={service ? 'Edit service' : 'New service'} onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await (service ? api.update(service.id, f) : api.create(f)); onClose() }}>
        <Label label="Service name"><Input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Label>
        <div className="grid grid-cols-2 gap-3">
          <Label label="Practice area"><Select value={f.practiceArea} onChange={e => setF({ ...f, practiceArea: e.target.value })}>{PRACTICE_AREAS.map(p => <option key={p}>{p}</option>)}</Select></Label>
          <Label label="Pricing model"><Select value={f.pricingModel} onChange={e => setF({ ...f, pricingModel: e.target.value as PricingModel })}>{Object.entries(PRICING_MODELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Label>
          <Label label={unit}><Input required type="number" min={0} max={f.pricingModel === 'contingency' ? 100 : undefined} value={f.price} onChange={e => setF({ ...f, price: Number(e.target.value) })} /></Label>
          <Label label="Upfront retainer ($)"><Input type="number" min={0} value={f.retainer} onChange={e => setF({ ...f, retainer: Number(e.target.value) })} /></Label>
        </div>
        <Label label="Description"><Textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Label>
        <div className="flex justify-between pt-2">
          {service && !inUse ? <Button type="button" variant="danger" onClick={async () => { if (confirm('Delete service?')) { await api.remove(service.id); onClose() } }}>Delete</Button> : <span />}
          <span className="flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Save</Button></span>
        </div>
      </form>
    </Modal>
  )
}
