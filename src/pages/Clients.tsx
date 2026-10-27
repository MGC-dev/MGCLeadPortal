import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clients as api } from '../api'
import { useQuery } from '../hooks'
import { Card, Input, PageHeader, StatusBadge, Table, Td } from '../components/ui'
import { date, initials } from '../format'

export default function Clients() {
  const clients = useQuery(() => api.list())
  const matters = useQuery(() => api.matters())
  const [q, setQ] = useState('')
  const rows = (clients ?? []).filter(c => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHeader title="Clients" subtitle="Only leads who have retained the firm appear here"
        actions={<Input placeholder="Search clients…" value={q} onChange={e => setQ(e.target.value)} className="!w-56" />} />
      <Card>
        <Table head={['Client', 'Practice area', 'Open matters', 'Status', 'Client since']} empty={rows.length ? undefined : 'No clients found'}>
          {rows.map(c => (
            <tr key={c.id}>
              <Td>
                <Link to={`/clients/${c.id}`} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{initials(c.name)}</span>
                  <span><span className="font-medium text-slate-900">{c.name}</span><br /><span className="text-xs text-slate-500">{c.email}</span></span>
                </Link>
              </Td>
              <Td>{c.practiceArea}</Td>
              <Td>{matters?.filter(m => m.clientId === c.id && m.status !== 'closed').length ?? 0}</Td>
              <Td><StatusBadge status={c.status} /></Td>
              <Td>{date(c.since)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
