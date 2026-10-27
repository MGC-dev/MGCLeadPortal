import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { activity, clients, documents, invoices } from '../api'
import { useQuery } from '../hooks'
import { ATTORNEYS, type Matter } from '../types'
import { ContactPanel } from '../components/contacts'
import { Button, Card, Input, Label, Modal, Select, StatusBadge } from '../components/ui'
import { ago, date, initials, money } from '../format'

export default function ClientDetail() {
  const { id = '' } = useParams()
  const client = useQuery(() => clients.get(id), [id])
  const matters = useQuery(() => clients.matters(id), [id])
  const docs = useQuery(() => documents.list())
  const invs = useQuery(() => invoices.list())
  const acts = useQuery(() => activity.forEntity('client', id), [id])
  const [adding, setAdding] = useState(false)
  if (!client) return null

  const myDocs = docs?.filter(d => d.clientId === id) ?? []
  const myInvs = invs?.filter(i => i.clientId === id) ?? []
  const billed = myInvs.reduce((s, i) => s + i.amount, 0)
  const paid = myInvs.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)

  return (
    <>
      <Link to="/clients" className="text-sm text-slate-500 hover:text-slate-800">← Clients</Link>
      <div className="mb-6 mt-2 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">{initials(client.name)}</span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{client.name} <StatusBadge status={client.status} /></h1>
          <p className="text-sm text-slate-500">{client.email} · {client.phone} · Client since {date(client.since)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Matters</h2><Button size="sm" variant="secondary" onClick={() => setAdding(true)}>+ Add matter</Button></div>
            {matters?.length ? matters.map(m => (
              <div key={m.id} className="flex items-center justify-between border-t border-slate-100 py-3 first:border-0">
                <div><p className="text-sm font-medium text-slate-900">{m.title}</p><p className="text-xs text-slate-500">{m.practiceArea} · {m.attorney} · opened {date(m.openedAt)}</p></div>
                <Select value={m.status} onChange={e => clients.updateMatter(m.id, { status: e.target.value as Matter['status'] })} className="!w-28">
                  <option value="open">open</option><option value="pending">pending</option><option value="closed">closed</option>
                </Select>
              </div>
            )) : <p className="text-sm text-slate-400">No matters yet.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Documents</h2>
            {myDocs.length ? myDocs.map(d => (
              <div key={d.id} className="flex items-center justify-between border-t border-slate-100 py-2.5 text-sm first:border-0">
                <span className="text-slate-800">{d.name}</span><StatusBadge status={d.status} />
              </div>
            )) : <p className="text-sm text-slate-400">No documents.</p>}
            <Link to="/documents" className="mt-2 inline-block text-xs text-brand-600 hover:underline">Manage in Documents →</Link>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Billing</h2><span className="text-sm text-slate-500">{money(paid)} paid of {money(billed)}</span></div>
            {myInvs.length ? myInvs.map(i => (
              <div key={i.id} className="flex items-center justify-between border-t border-slate-100 py-2.5 text-sm first:border-0">
                <span className="text-slate-800">{i.number} · {i.description}</span>
                <span className="flex items-center gap-3">{money(i.amount)}<StatusBadge status={i.status} /></span>
              </div>
            )) : <p className="text-sm text-slate-400">No invoices.</p>}
            <Link to="/payments" className="mt-2 inline-block text-xs text-brand-600 hover:underline">Manage in Payments →</Link>
          </Card>
        </div>

        <div className="space-y-6">
        <Card className="p-5"><ContactPanel clientId={id} /></Card>
        <Card className="h-fit p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Timeline</h2>
          {acts?.length ? acts.map(a => <div key={a.id} className="border-t border-slate-100 py-2 text-sm first:border-0"><p className="text-slate-700">{a.text}</p><p className="text-xs text-slate-400">{ago(a.at)}</p></div>)
            : <p className="text-sm text-slate-400">No activity yet.</p>}
        </Card>
        </div>
      </div>

      {adding && <AddMatter clientId={id} area={client.practiceArea} onClose={() => setAdding(false)} />}
    </>
  )
}

function AddMatter({ clientId, area, onClose }: { clientId: string; area: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [attorney, setAttorney] = useState(ATTORNEYS[0])
  return (
    <Modal title="Add matter" onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await clients.addMatter({ clientId, title, practiceArea: area, attorney, status: 'open' }); onClose() }}>
        <Label label="Matter title"><Input required value={title} onChange={e => setTitle(e.target.value)} /></Label>
        <Label label="Responsible attorney"><Select value={attorney} onChange={e => setAttorney(e.target.value)}>{ATTORNEYS.map(a => <option key={a}>{a}</option>)}</Select></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Add matter</Button></div>
      </form>
    </Modal>
  )
}
