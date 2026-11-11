import { useState } from 'react'
import { leadsApi, useQuery } from '../../api'
import type { Lead, StageId } from '../../api/types'
import { useUi } from '../../app/UiContext'
import { HeaderActions } from '../../shared/HeaderActions'
import { AddEnquiryButton, ExpandingSearch, OwnerFilter } from '../../shared/HeaderTools'
import { Icon } from '../../shared/Icon'
import { toast } from '../../shared/toast'
import { money } from '../../shared/format'
import { STAGES, STAGE, feeKnown } from '../lead/selectors'

/** A pipeline card shows only what the Add Enquiry form collects: name, phone, matter, fee, practice area and notes. */
function Card({ l, onDragStart }: { l: Lead; onDragStart: (id: string) => void }) {
  const { openLead } = useUi()
  return (
    <button type="button" className={'card' + (Date.now() - l.created < 1500 ? ' is-new' : '')} draggable onClick={() => openLead(l.id)}
      onDragStart={e => { onDragStart(l.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id) }}>
      <span className="card__top">
        <span className="card__who"><span className="card__name">{l.name}</span><span className="card__meta">{l.matter}</span></span>
        {feeKnown(l) && <span className="card__value num">{money(l.value)}</span>}
      </span>
      <span className="card__phone"><Icon name="phone" small />{l.phone}</span>
      <span className="card__tags">
        <span className="chip chip--soft">{l.practice}</span>
      </span>
      {l.notes && <span className="card__notes">{l.notes}</span>}
    </button>
  )
}

export default function Pipeline() {
  const leads = useQuery(() => leadsApi.list())
  const { openModal } = useUi()
  const [owner, setOwner] = useState('all')
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  if (!leads) return null

  const term = q.trim().toLowerCase()
  const match = (l: Lead) => (owner === 'all' || l.owner === owner) && (!term || `${l.name} ${l.matter} ${l.practice} ${l.owner}`.toLowerCase().includes(term))
  const steps = STAGES.length

  const drop = async (to: StageId) => {
    const l = leads.find(x => x.id === drag)
    setDrag(null); setOver(null)
    if (!l || l.stage === to) return
    if (to === 'lost') openModal({ type: 'lost', id: l.id })
    else if (to === 'contract' && !l.doc) openModal((l.serviceIds ?? []).length ? { type: 'send-docs', id: l.id } : { type: 'pick-services', id: l.id, next: 'send-docs' }) // services, then documents; the card moves once they are sent
    else if (to === 'payment' && l.doc?.status === 'signed') openModal({ type: 'request-payment', id: l.id }) // confirm the services and the total first
    else if ((to === 'signed' || to === 'payment') && l.doc?.status !== 'signed') {
      if (!l.doc) await leadsApi.sendContract(l.id)
      else await leadsApi.sendForSignature(l.id)
    } else await leadsApi.setStage(l.id, to)
  }

  const col = (id: StageId, label: string, i: number) => {
    const all = leads.filter(l => l.stage === id), ls = all.filter(match)
    const tone = id === 'lost' ? 'var(--red)' : `color-mix(in srgb, var(--tint) ${Math.round(35 + (i / (steps - 1)) * 65)}%, var(--surface))`
    return (
      <section key={id} className={'col' + (id === 'lost' ? ' col--lost' : '') + (over === id ? ' is-over' : '')} aria-label={label} style={{ ['--tone' as string]: tone }}
        onDragOver={e => { if (drag) { e.preventDefault(); setOver(id) } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(o => (o === id ? null : o)) }}
        onDrop={e => { e.preventDefault(); void drop(id) }}>
        <div className="col__head">
          <div className="col__title"><b>{label}</b><span className="col__count">{ls.length}{ls.length !== all.length ? `/${all.length}` : ''}</span></div>
          {id !== 'lost' && STAGE[id].i >= 3 && <span className="col__value num">{money(ls.filter(feeKnown).reduce((a, l) => a + l.value, 0))}</span>}
        </div>
        <div className="col__cards">
          {ls.map(l => <Card key={l.id} l={l} onDragStart={setDrag} />)}
          {!ls.length && <div className="col__empty">{all.length ? 'No matches' : id === 'lost' ? 'Drop a lead here to mark it as lost' : 'Drop a lead here'}</div>}
        </div>
      </section>
    )
  }

  return (
    <>
      <HeaderActions>
        <AddEnquiryButton />
        <ExpandingSearch value={q} onChange={setQ} />
        <OwnerFilter owner={owner} onChange={setOwner} />
      </HeaderActions>
      <div className="board-wrap"><div className="board" onDragEnd={() => { setDrag(null); setOver(null) }}>
        {STAGES.map((s, i) => col(s.id, s.label, i))}{col('lost', 'Lost', steps)}
      </div></div>
    </>
  )
}
