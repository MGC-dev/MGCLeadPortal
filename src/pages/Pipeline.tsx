import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { agenda as agendaApi, leads as api, services as serviceApi } from '../api'
import { useQuery } from '../hooks'
import { LEAD_STAGES, type AgendaItem, type Lead, type LeadStatus } from '../types'
import { Button, Card, Input, PageHeader } from '../components/ui'
import { AddLead, LeadModal } from '../components/LeadModal'
import { ago, dayDiff, dayLabel, money } from '../format'

export default function Pipeline() {
  const leads = useQuery(() => api.list())
  const services = useQuery(() => serviceApi.list())
  const agenda = useQuery(() => agendaApi.list())
  const [params, setParams] = useSearchParams()
  useEffect(() => { const id = params.get('lead'); if (id) setSelected({ id, convert: false }) }, [params])
  const nextStep = (id: string) => agenda?.find(a => a.leadId === id && !a.done)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<{ id: string; convert: boolean }>()
  const [search, setSearch] = useState('')
  const [dragId, setDragId] = useState<string>()
  const [overStage, setOverStage] = useState<LeadStatus>()

  const filtered = (leads ?? []).filter(l => `${l.name} ${l.email} ${l.practiceArea}`.toLowerCase().includes(search.toLowerCase()))
  const selectedLead = leads?.find(l => l.id === selected?.id)

  const drop = (stage: LeadStatus) => {
    const lead = leads?.find(l => l.id === dragId)
    if (lead && lead.status !== stage) {
      if (stage === 'retained') setSelected({ id: lead.id, convert: true }) // retaining requires the convert step
      else api.moveTo(lead.id, stage)
    }
    setDragId(undefined); setOverStage(undefined)
  }

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Drag cards across stages. Every stage creates its next step in Agenda. Dropping on Retained starts client conversion."
        actions={<>
          <Input placeholder="Search pipeline…" value={search} onChange={e => setSearch(e.target.value)} className="!w-56" />
          <Button onClick={() => setAdding(true)}>+ New lead</Button>
        </>} />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {LEAD_STAGES.map(stage => {
          const items = filtered.filter(l => l.status === stage.key)
          return (
            <div key={stage.key}
              onDragOver={e => { e.preventDefault(); setOverStage(stage.key) }}
              onDragLeave={() => setOverStage(undefined)}
              onDrop={() => drop(stage.key)}
              className={`w-64 shrink-0 rounded-xl p-2 ${overStage === stage.key ? 'bg-brand-100' : 'bg-slate-100'}`}>
              <div className="mb-2 flex items-center justify-between px-2 pt-1 text-sm font-semibold text-slate-700">
                {stage.label}<span className="text-xs font-normal text-slate-500">{items.length} · {money(items.reduce((s, l) => s + l.value, 0))}</span>
              </div>
              <div className="space-y-2">
                {items.map(l => <LeadCard key={l.id} lead={l} service={services?.find(s => s.id === l.serviceId)?.name} next={nextStep(l.id)} onOpen={() => setSelected({ id: l.id, convert: false })} onDrag={setDragId} />)}
              </div>
            </div>
          )
        })}
      </div>
      {adding && <AddLead onClose={() => setAdding(false)} />}
      {selectedLead && <LeadModal lead={selectedLead} startConverting={selected!.convert} onClose={() => { setSelected(undefined); if (params.has('lead')) setParams({}) }} />}
    </>
  )
}

function LeadCard({ lead: l, service, next, onOpen, onDrag }: { lead: Lead; service?: string; next?: AgendaItem; onOpen: () => void; onDrag: (id?: string) => void }) {
  const locked = l.status === 'retained' // retained leads are clients now; can't be dragged back
  return (
    <Card className={`p-3 hover:border-brand-500 ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}>
      <div draggable={!locked} onDragStart={() => onDrag(l.id)} onDragEnd={() => onDrag(undefined)} onClick={onOpen}>
        <p className="font-medium text-slate-900">{l.name}</p>
        <p className="text-xs text-slate-500">{service ?? l.practiceArea} · {l.source}</p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">{money(l.value)}</span>
          <span className="text-slate-400">{ago(l.createdAt)}</span>
        </div>
        {!locked && l.status !== 'lost' && (
          <p className={`mt-2 truncate rounded px-1.5 py-0.5 text-xs ${!next ? 'bg-amber-50 text-amber-700' : new Date(next.dueAt) < new Date() && dayDiff(next.dueAt) < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
            {next ? `${dayLabel(next.dueAt)} · ${next.title.split(' – ')[0]}` : 'No next step'}
          </p>
        )}
      </div>
    </Card>
  )
}
