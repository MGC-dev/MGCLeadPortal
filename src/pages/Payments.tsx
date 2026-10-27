import { useState } from 'react'
import { clients as clientApi, invoices as api, leads as leadApi } from '../api'
import { useQuery } from '../hooks'
import { Button, Card, Input, Label, Modal, PageHeader, Select, Stat, StatusBadge, Table, Td } from '../components/ui'
import { date, money } from '../format'
import type { Invoice } from '../types'

export default function Payments() {
  const invs = useQuery(() => api.list())
  const clients = useQuery(() => clientApi.list())
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('all')
  const leads = useQuery(() => leadApi.list())
  const name = (i: Invoice) => (i.clientId ? clients?.find(c => c.id === i.clientId)?.name : leads?.find(l => l.id === i.leadId)?.name) ?? '—'
  const rows = (invs ?? []).filter(i => filter === 'all' || i.status === filter)
  const sum = (f: (i: Invoice) => boolean) => money((invs ?? []).filter(f).reduce((s, i) => s + i.amount, 0))

  return (
    <>
      <PageHeader title="Payments" subtitle="Retainers and invoices with online payment links"
        actions={<Button onClick={() => setAdding(true)}>+ New invoice</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Collected" value={sum(i => i.status === 'paid')} />
        <Stat label="Outstanding" value={sum(i => i.status === 'sent')} />
        <Stat label="Overdue" value={sum(i => i.status === 'overdue')} tone="red" />
        <Stat label="Drafts" value={sum(i => i.status === 'draft')} />
      </div>
      <div className="mb-3 w-44"><Select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">All statuses</option>{['draft', 'sent', 'overdue', 'paid'].map(s => <option key={s}>{s}</option>)}
      </Select></div>
      <Card>
        <Table head={['Invoice', 'Payer', 'Type', 'Amount', 'Due', 'Status', '']} empty={rows.length ? undefined : 'No invoices'}>
          {rows.map(i => (
            <tr key={i.id}>
              <Td><span className="font-medium text-slate-900">{i.number}</span><br /><span className="text-xs text-slate-500">{i.description}</span></Td>
              <Td>{name(i)}{!i.clientId && <span className="ml-1.5 text-xs text-slate-400">lead</span>}</Td>
              <Td className="capitalize">{i.type}</Td>
              <Td className="font-medium">{money(i.amount)}</Td>
              <Td>{i.status === 'paid' ? `Paid ${date(i.paidAt)}${i.method ? ` · ${i.method}` : ''}` : date(i.dueDate)}</Td>
              <Td><StatusBadge status={i.status} /></Td>
              <Td className="whitespace-nowrap text-right">
                {i.status === 'draft' && <Button size="sm" onClick={() => api.send(i.id)}>Send payment link</Button>}
                {(i.status === 'sent' || i.status === 'overdue') && <>
                  <Button size="sm" variant="secondary" onClick={() => api.send(i.id)}>Remind</Button>{' '}
                  <Button size="sm" onClick={() => api.markPaid(i.id)}>Record payment</Button>
                </>}
                {i.status !== 'paid' && <Button size="sm" variant="ghost" onClick={() => confirm('Delete invoice?') && api.remove(i.id)}>✕</Button>}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {adding && <NewInvoice onClose={() => setAdding(false)} />}
    </>
  )
}

function NewInvoice({ onClose }: { onClose: () => void }) {
  const clients = useQuery(() => clientApi.list())
  const matters = useQuery(() => clientApi.matters())
  const leads = useQuery(() => leadApi.list())
  const [who, setWho] = useState('')
  const [f, setF] = useState({ matterId: '', type: 'invoice' as Invoice['type'], description: '', amount: 0, dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10) })
  return (
    <Modal title="New invoice" onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await api.create({ ...f, clientId: who.startsWith('c:') ? who.slice(2) : undefined, leadId: who.startsWith('l:') ? who.slice(2) : undefined, matterId: f.matterId || undefined, dueDate: new Date(f.dueDate).toISOString() }); onClose() }}>
        <Label label="Bill to"><Select required value={who} onChange={e => { setWho(e.target.value); setF({ ...f, matterId: '' }) }}>
          <option value="">Select a client or lead…</option>
          <optgroup label="Clients">{clients?.map(c => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
          <optgroup label="Leads">{leads?.filter(l => l.status !== 'retained' && l.status !== 'lost').map(l => <option key={l.id} value={`l:${l.id}`}>{l.name}</option>)}</optgroup>
        </Select></Label>
        {who.startsWith('c:') && <Label label="Matter (optional)"><Select value={f.matterId} onChange={e => setF({ ...f, matterId: e.target.value })}><option value="">—</option>{matters?.filter(m => m.clientId === who.slice(2)).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</Select></Label>}
        <div className="grid grid-cols-2 gap-3">
          <Label label="Type"><Select value={f.type} onChange={e => setF({ ...f, type: e.target.value as Invoice['type'] })}><option value="invoice">Invoice</option><option value="retainer">Retainer</option></Select></Label>
          <Label label="Amount ($)"><Input required type="number" min={1} value={f.amount || ''} onChange={e => setF({ ...f, amount: Number(e.target.value) })} /></Label>
        </div>
        <Label label="Description"><Input required value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Label>
        <Label label="Due date"><Input type="date" required value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Create draft</Button></div>
      </form>
    </Modal>
  )
}
