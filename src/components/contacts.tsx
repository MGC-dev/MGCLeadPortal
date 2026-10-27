import { useState } from 'react'
import { Link } from 'react-router-dom'
import { agenda as agendaApi, clients as clientApi, communications, leads as leadApi } from '../api'
import { useQuery } from '../hooks'
import { AGENDA_TYPES, ATTORNEYS, type AgendaItem, type AgendaType, type Channel, type Message } from '../types'
import { Badge, Button, Input, Label, Modal, Select, Textarea } from './ui'
import { ago, dayDiff, toLocalInput, when } from '../format'

export interface ContactRef { leadId?: string; clientId?: string }

/** Resolves a lead/client reference to a display name + link, used by Agenda, Communication and panels. */
export function useContactIndex() {
  const leads = useQuery(() => leadApi.list())
  const clients = useQuery(() => clientApi.list())
  const resolve = (r: ContactRef) => {
    const client = r.clientId ? clients?.find(c => c.id === r.clientId) : undefined
    if (client) return { name: client.name, to: `/clients/${client.id}`, kind: 'client' as const, email: client.email, phone: client.phone }
    const lead = r.leadId ? leads?.find(l => l.id === r.leadId) : undefined
    if (lead) return { name: lead.name, to: `/pipeline?lead=${lead.id}`, kind: 'lead' as const, email: lead.email, phone: lead.phone }
    return { name: '—', to: undefined, kind: undefined, email: '', phone: '' }
  }
  const options = [
    ...(clients ?? []).map(c => ({ key: `c:${c.id}`, label: `${c.name} (client)`, ref: { clientId: c.id } as ContactRef })),
    ...(leads ?? []).filter(l => !l.clientId && l.status !== 'lost').map(l => ({ key: `l:${l.id}`, label: `${l.name} (lead)`, ref: { leadId: l.id } as ContactRef })),
  ]
  const keyOf = (r: ContactRef) => (r.clientId ? `c:${r.clientId}` : r.leadId ? `l:${r.leadId}` : '')
  return { resolve, options, keyOf }
}

export function ContactLink({ r }: { r: ContactRef }) {
  const { resolve } = useContactIndex()
  const c = resolve(r)
  return c.to ? <Link to={c.to} onClick={e => e.stopPropagation()} className="text-brand-600 hover:underline">{c.name}</Link> : <span>—</span>
}

export const TYPE_ICON: Record<AgendaType, string> = { task: '☑', call: '☎', meeting: '👥', follow_up: '↻', deadline: '⚑' }

export function AgendaModal({ onClose, contact, defaultType = 'task' }: { onClose: () => void; contact?: ContactRef; defaultType?: AgendaType }) {
  const { options, keyOf } = useContactIndex()
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0)
  const [f, setF] = useState({ type: defaultType, title: '', dueAt: toLocalInput(tomorrow), assignedTo: ATTORNEYS[0], notes: '' })
  const [who, setWho] = useState(contact ? keyOf(contact) : '')
  const ref = contact ?? options.find(o => o.key === who)?.ref ?? {}
  return (
    <Modal title="Schedule" onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await agendaApi.create({ ...f, ...ref, dueAt: new Date(f.dueAt).toISOString() }); onClose() }}>
        <div className="grid grid-cols-2 gap-3">
          <Label label="Type"><Select value={f.type} onChange={e => setF({ ...f, type: e.target.value as AgendaType })}>{Object.entries(AGENDA_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Label>
          <Label label="When"><Input type="datetime-local" required value={f.dueAt} onChange={e => setF({ ...f, dueAt: e.target.value })} /></Label>
        </div>
        <Label label="Title"><Input required autoFocus value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Discovery call with…" /></Label>
        <div className="grid grid-cols-2 gap-3">
          <Label label="Related to"><Select disabled={!!contact} value={who} onChange={e => setWho(e.target.value)}><option value="">— none —</option>{options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</Select></Label>
          <Label label="Assigned to"><Select value={f.assignedTo} onChange={e => setF({ ...f, assignedTo: e.target.value })}>{ATTORNEYS.map(a => <option key={a}>{a}</option>)}</Select></Label>
        </div>
        <Label label="Notes"><Textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Schedule</Button></div>
      </form>
    </Modal>
  )
}

export function ComposeModal({ onClose, contact, channel = 'email', replyTo }: { onClose: () => void; contact?: ContactRef; channel?: Channel; replyTo?: Message }) {
  const { options, keyOf, resolve } = useContactIndex()
  const initial = contact ?? (replyTo ? { leadId: replyTo.leadId, clientId: replyTo.clientId } : undefined)
  const [who, setWho] = useState(initial ? keyOf(initial) : '')
  const [ch, setCh] = useState<Channel>(replyTo?.channel ?? channel)
  const [subject, setSubject] = useState(replyTo?.subject ? `Re: ${replyTo.subject.replace(/^Re: /, '')}` : '')
  const [body, setBody] = useState('')
  const ref = initial ?? options.find(o => o.key === who)?.ref
  const to = ref ? resolve(ref) : undefined
  return (
    <Modal title={replyTo ? 'Reply' : 'New message'} onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (!ref) return; await communications.send({ ...ref, channel: ch, subject: ch === 'email' ? subject : undefined, body }); onClose() }}>
        <div className="grid grid-cols-3 gap-3">
          <Label label="Channel"><Select value={ch} onChange={e => setCh(e.target.value as Channel)}><option value="email">Email</option><option value="sms">Text (SMS)</option></Select></Label>
          <div className="col-span-2"><Label label="To"><Select required disabled={!!initial} value={who} onChange={e => setWho(e.target.value)}><option value="">Select a lead or client…</option>{options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</Select></Label></div>
        </div>
        {to && <p className="-mt-1 text-xs text-slate-500">{ch === 'email' ? to.email : to.phone}</p>}
        {ch === 'email' && <Label label="Subject"><Input required value={subject} onChange={e => setSubject(e.target.value)} /></Label>}
        <Label label="Message"><Textarea required rows={5} value={body} onChange={e => setBody(e.target.value)} /></Label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button>Send</Button></div>
      </form>
    </Modal>
  )
}

export function AgendaRow({ item, showContact = true }: { item: AgendaItem; showContact?: boolean }) {
  const late = !item.done && new Date(item.dueAt) < new Date()
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 py-2.5 first:border-0">
      <input type="checkbox" checked={item.done} onChange={() => agendaApi.toggle(item.id)} className="mt-1 h-4 w-4 accent-[#2a4457]" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${item.done ? 'text-slate-400 line-through' : 'font-medium text-slate-900'}`}>{TYPE_ICON[item.type]} {item.title}</p>
        <p className={`text-xs ${late ? 'font-medium text-red-600' : 'text-slate-500'}`}>
          {when(item.dueAt)}{late && dayDiff(item.dueAt) < 0 ? ' · overdue' : late ? ' · due' : ''} · {item.assignedTo}
          {showContact && (item.leadId || item.clientId) && <> · <ContactLink r={item} /></>}
        </p>
      </div>
    </div>
  )
}

/** Next steps + recent messages for one lead/client. Used inside the lead panel and client page. */
export function ContactPanel({ leadId, clientId }: ContactRef) {
  const items = useQuery(() => agendaApi.list())
  const msgs = useQuery(() => communications.list())
  const [modal, setModal] = useState<'schedule' | 'email' | 'sms'>()
  const mine = (x: ContactRef) => (clientId ? x.clientId === clientId : x.leadId === leadId)
  const open = (items ?? []).filter(i => mine(i) && !i.done)
  const recent = (msgs ?? []).filter(mine).slice(0, 4)
  const ref = { leadId, clientId }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next steps</p>
          <Button size="sm" variant="secondary" onClick={() => setModal('schedule')}>+ Schedule</Button>
        </div>
        {open.length ? open.map(i => <AgendaRow key={i.id} item={i} showContact={false} />)
          : <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">No next step scheduled. Schedule a call, task or meeting.</p>}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Messages</p>
          <span className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setModal('email')}>✉ Email</Button>
            <Button size="sm" variant="secondary" onClick={() => setModal('sms')}>💬 Text</Button>
          </span>
        </div>
        {recent.length ? recent.map(m => (
          <div key={m.id} className="border-t border-slate-100 py-2 text-sm first:border-0">
            <p className="flex items-center gap-1.5 text-slate-800">
              <span>{m.channel === 'email' ? '✉' : '💬'}</span><span className="text-xs text-slate-400">{m.direction === 'in' ? '← received' : '→ sent'}</span>
              <span className="truncate">{m.subject ?? m.body}</span>
              {m.source && <Badge tone="purple">{m.source}</Badge>}
            </p>
            <p className="text-xs text-slate-400">{ago(m.at)}</p>
          </div>
        )) : <p className="text-xs text-slate-400">No messages yet.</p>}
      </div>
      {modal === 'schedule' && <AgendaModal contact={ref} onClose={() => setModal(undefined)} />}
      {(modal === 'email' || modal === 'sms') && <ComposeModal contact={ref} channel={modal} onClose={() => setModal(undefined)} />}
    </div>
  )
}
