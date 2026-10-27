import { useState } from 'react'
import { Link } from 'react-router-dom'
import { agenda as agendaApi, leads as api, services as serviceApi } from '../api'
import { useQuery } from '../hooks'
import { LEAD_STAGES, PRACTICE_AREAS, SOURCES, type Lead } from '../types'
import { Badge, Button, Card, Input, PageHeader, Select, Table, Td } from '../components/ui'
import { AddLead, LeadModal } from '../components/LeadModal'
import { date, dayDiff, dayLabel, money } from '../format'

export default function Leads() {
  const leads = useQuery(() => api.list())
  const services = useQuery(() => serviceApi.list())
  const agenda = useQuery(() => agendaApi.list())
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Lead>()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [source, setSource] = useState('')
  const [area, setArea] = useState('')

  const rows = (leads ?? []).filter(l =>
    `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(q.toLowerCase()) &&
    (!stage || l.status === stage) && (!source || l.source === source) && (!area || l.practiceArea === area))
  const selectedLead = leads?.find(l => l.id === selected?.id)

  return (
    <>
      <PageHeader title="Leads" subtitle={`${leads?.length ?? 0} total leads · manage stages in Pipeline`}
        actions={<Button onClick={() => setAdding(true)}>+ New lead</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search name, email, phone…" value={q} onChange={e => setQ(e.target.value)} className="!w-64" />
        <Select value={stage} onChange={e => setStage(e.target.value)} className="!w-40"><option value="">All stages</option>{LEAD_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
        <Select value={source} onChange={e => setSource(e.target.value)} className="!w-40"><option value="">All sources</option>{SOURCES.map(s => <option key={s}>{s}</option>)}</Select>
        <Select value={area} onChange={e => setArea(e.target.value)} className="!w-44"><option value="">All practice areas</option>{PRACTICE_AREAS.map(s => <option key={s}>{s}</option>)}</Select>
      </div>
      <Card>
        <Table head={['Name', 'Contact', 'Service', 'Source', 'Stage', 'Value', 'Owner', 'Next step', 'Last contact']} empty={rows.length ? undefined : 'No leads match your filters'}>
          {rows.map(l => (
            <tr key={l.id} onClick={() => setSelected(l)} className="cursor-pointer">
              <Td className="font-medium text-slate-900">{l.name}</Td>
              <Td>{l.email}<br /><span className="text-xs text-slate-500">{l.phone}</span></Td>
              <Td>{services?.find(s => s.id === l.serviceId)?.name ?? '—'}<br /><span className="text-xs text-slate-500">{l.practiceArea}</span></Td><Td>{l.source}</Td>
              <Td>
                <Badge tone={l.status === 'retained' ? 'green' : l.status === 'lost' ? 'gray' : 'blue'}>{LEAD_STAGES.find(s => s.key === l.status)!.label}</Badge>
                {l.clientId && <Link to={`/clients/${l.clientId}`} onClick={e => e.stopPropagation()} className="ml-2 text-xs text-brand-600 hover:underline">client →</Link>}
              </Td>
              <Td>{money(l.value)}</Td><Td>{l.assignedTo}</Td><Td className="whitespace-nowrap">{(() => { const n = agenda?.find(a => a.leadId === l.id && !a.done); return n ? <span className={dayDiff(n.dueAt) < 0 ? 'text-red-600' : ''}>{dayLabel(n.dueAt)}<br /><span className="text-xs text-slate-500">{n.title.split(' – ')[0]}</span></span> : l.status === 'retained' || l.status === 'lost' ? '—' : <span className="text-amber-600">none</span> })()}</Td><Td>{date(l.lastContactAt)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      {adding && <AddLead onClose={() => setAdding(false)} />}
      {selectedLead && <LeadModal lead={selectedLead} onClose={() => setSelected(undefined)} />}
    </>
  )
}
