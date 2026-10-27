import { useState } from 'react'
import { clients as clientApi, documents as api, leads as leadApi } from '../api'
import { useQuery } from '../hooks'
import { Button, Card, Input, Label, Modal, PageHeader, Select, Stat, StatusBadge, Table, Td } from '../components/ui'
import { date } from '../format'

const KINDS = ['Retainer Agreement', 'Engagement Letter', 'Fee Agreement', 'HIPAA Authorization', 'Power of Attorney', 'Non-Disclosure Agreement']

export default function Documents() {
  const docs = useQuery(() => api.list())
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('all')
  const rows = (docs ?? []).filter(d => filter === 'all' || d.status === filter)
  const count = (s: string) => docs?.filter(d => d.status === s).length ?? 0

  return (
    <>
      <PageHeader title="Documents & e-signature" subtitle="Send agreements for signature and track every status"
        actions={<Button onClick={() => setAdding(true)}>+ New document</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Drafts" value={count('draft')} />
        <Stat label="Awaiting signature" value={count('sent') + count('viewed')} />
        <Stat label="Signed" value={count('signed')} />
        <Stat label="Declined" value={count('declined')} />
      </div>
      <div className="mb-3 w-44"><Select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">All statuses</option>{['draft', 'sent', 'viewed', 'signed', 'declined'].map(s => <option key={s}>{s}</option>)}
      </Select></div>
      <Card>
        <Table head={['Document', 'Recipient', 'Status', 'Sent', 'Signed', '']} empty={rows.length ? undefined : 'No documents'}>
          {rows.map(d => (
            <tr key={d.id}>
              <Td><span className="font-medium text-slate-900">{d.name}</span><br /><span className="text-xs text-slate-500">{d.kind}</span></Td>
              <Td>{d.recipientName}<br /><span className="text-xs text-slate-500">{d.recipientEmail}</span></Td>
              <Td><StatusBadge status={d.status} /></Td>
              <Td>{date(d.sentAt)}</Td><Td>{date(d.signedAt)}</Td>
              <Td className="whitespace-nowrap text-right">
                {d.status === 'draft' && <Button size="sm" onClick={() => api.send(d.id)}>Send for signature</Button>}
                {d.status === 'declined' && <Button size="sm" variant="secondary" onClick={() => api.send(d.id)}>Resend</Button>}
                {(d.status === 'sent' || d.status === 'viewed') && (
                  <span className="inline-flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => api.send(d.id)}>Remind</Button>
                    <select className="rounded-lg border border-slate-300 px-1.5 py-1 text-xs text-slate-500" value="" title="Demo only: simulate the signer's action"
                      onChange={e => api.simulate(d.id, e.target.value as 'viewed' | 'signed' | 'declined')}>
                      <option value="">Simulate…</option><option value="viewed">Viewed</option><option value="signed">Signed</option><option value="declined">Declined</option>
                    </select>
                  </span>
                )}
                {d.status !== 'signed' && <Button size="sm" variant="ghost" onClick={() => confirm('Delete document?') && api.remove(d.id)}>✕</Button>}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {adding && <NewDoc onClose={() => setAdding(false)} />}
    </>
  )
}

function NewDoc({ onClose }: { onClose: () => void }) {
  const clients = useQuery(() => clientApi.list())
  const leads = useQuery(() => leadApi.list())
  const [kind, setKind] = useState(KINDS[0])
  const [who, setWho] = useState('')
  const [subject, setSubject] = useState('')

  const options = [
    ...(clients ?? []).map(c => ({ key: `c:${c.id}`, label: `${c.name} (client)`, name: c.name, email: c.email })),
    ...(leads ?? []).filter(l => !l.clientId && l.status !== 'lost').map(l => ({ key: `l:${l.id}`, label: `${l.name} (lead)`, name: l.name, email: l.email })),
  ]
  const target = options.find(o => o.key === who)

  return (
    <Modal title="New document" onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => {
        e.preventDefault()
        if (!target) return
        await api.create({
          name: subject || `${kind} – ${target.name}`, kind, recipientName: target.name, recipientEmail: target.email,
          clientId: who.startsWith('c:') ? who.slice(2) : undefined, leadId: who.startsWith('l:') ? who.slice(2) : undefined,
        })
        onClose()
      }}>
        <Label label="Template"><Select value={kind} onChange={e => setKind(e.target.value)}>{KINDS.map(k => <option key={k}>{k}</option>)}</Select></Label>
        <Label label="Recipient"><Select required value={who} onChange={e => setWho(e.target.value)}><option value="">Select a lead or client…</option>{options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</Select></Label>
        <Label label="Document name (optional)"><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={`${kind} – recipient`} /></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Create draft</Button></div>
      </form>
    </Modal>
  )
}
