import { db, delay, uid } from './db'
import type { Activity, AgendaItem, AgendaType, Campaign, CampaignStep, Client, Invoice, Lead, LeadStatus, LegalDocument, Matter, Message, Service } from '../types'
import { ENGAGEMENT_KINDS, LEAD_STAGES } from '../types'

const now = () => new Date().toISOString()
const clone = <T,>(v: T): T => structuredClone(v)
const byNewest = <T extends { createdAt?: string; at?: string }>(a: T, b: T) =>
  (b.createdAt ?? b.at ?? '').localeCompare(a.createdAt ?? a.at ?? '')

function log(entityType: Activity['entityType'], entityId: string, text: string) {
  db.table('activities').unshift({ id: uid('a'), entityType, entityId, text, at: now() })
}

function addMessage(m: Omit<Message, 'id' | 'at'> & { at?: string }) {
  db.table('messages').unshift({ ...m, id: uid('ms'), at: m.at ?? now() })
}

const merge = (t: string, lead: Lead) =>
  t.replace(/{{first_name}}/g, lead.name.split(' ')[0]).replace(/{{practice_area}}/g, lead.practiceArea)
    .replace(/{{attorney}}/g, lead.assignedTo).replace(/{{booking_link}}/g, '[booking link]').replace(/{{payment_link}}/g, '[payment link]')

/** Enrolls the lead in matching active campaigns; an immediate first email/SMS step is logged in Communication. */
function enrollCampaigns(trigger: Campaign['trigger'], lead: Lead) {
  db.table('campaigns')
    .filter(c => c.status === 'active' && c.trigger === trigger)
    .forEach(c => {
      c.stats.enrolled++
      const first = c.steps[0]
      if (first && (first.type === 'email' || first.type === 'sms') && first.delayDays === 0) {
        c.stats.sent++
        addMessage({ channel: first.type, direction: 'out', leadId: lead.id, subject: first.type === 'email' ? merge(first.subject, lead) : undefined, body: merge(first.body, lead), source: c.name })
      }
    })
}

// ---- Agenda automation: each pipeline stage creates its next step; moving on closes the previous auto step.
function at(daysAhead: number, hour: number) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(hour, 0, 0, 0); return d.toISOString()
}
function schedule(lead: Lead, type: AgendaType, title: string, dueAt: string) {
  db.table('agenda').unshift({ id: uid('g'), type, title, dueAt, done: false, assignedTo: lead.assignedTo, leadId: lead.id, auto: true })
}
function closeAutoItems(leadId: string) {
  db.table('agenda').filter(a => a.leadId === leadId && a.auto && !a.done).forEach(a => { a.done = true; a.completedAt = now() })
}
function stageAgenda(lead: Lead, status: LeadStatus) {
  const n = lead.name
  const plan: Partial<Record<LeadStatus, [AgendaType, string, number, number]>> = {
    contacted: ['call', `Second contact attempt – ${n}`, 1, 10],
    follow_up: ['follow_up', `Follow up with ${n}`, 3, 10],
    consultation: ['meeting', `Discovery call – ${n}`, 1, 10],
    attorney_review: ['task', `Attorney review – ${n}`, 1, 9],
    strategy: ['meeting', `Strategy session – ${n}`, 3, 11],
    pending: ['task', `Prepare engagement & payment – ${n}`, 1, 9],
    engagement_sent: ['follow_up', `Follow up on engagement letter – ${n}`, 2, 10],
    payment_link_sent: ['follow_up', `Confirm retainer payment – ${n}`, 2, 10],
    payment_plan: ['task', `Finalize payment plan – ${n}`, 2, 10],
  }
  const p = plan[status]
  if (p) schedule(lead, p[0], p[1], at(p[2], p[3]))
}

const STAGE_ORDER = LEAD_STAGES.map(s => s.key)

function setStage(lead: Lead, status: LeadStatus) {
  lead.status = status
  lead.lastContactAt = now()
  log('lead', lead.id, `${lead.name} moved to ${LEAD_STAGES.find(s => s.key === status)!.label}`)
  closeAutoItems(lead.id)
  stageAgenda(lead, status)
  if (status === 'consultation') enrollCampaigns('consultation_booked', lead)
  if (status === 'engagement_sent') enrollCampaigns('proposal_sent', lead)
}

/** Automatic stage change driven by Documents/Payments. Only ever moves a lead forward. */
function advanceLead(id: string | undefined, to: LeadStatus) {
  const lead = db.table('leads').find(l => l.id === id)
  if (!lead || lead.status === 'retained' || lead.status === 'lost') return
  if (STAGE_ORDER.indexOf(lead.status) >= STAGE_ORDER.indexOf(to)) return
  setStage(lead, to)
}

const nextInvoiceNumber = () => `INV-${1000 + db.table('invoices').length + 1}`

// ---------- Leads ----------
export const leads = {
  list: () => delay(clone(db.table('leads')).sort(byNewest)),
  get: (id: string) => delay(clone(db.table('leads').find(l => l.id === id)!)),
  create(data: Pick<Lead, 'name' | 'email' | 'phone' | 'source' | 'practiceArea' | 'serviceId' | 'value' | 'assignedTo' | 'notes'>) {
    const lead: Lead = { ...data, id: uid('l'), status: 'new', createdAt: now() }
    db.table('leads').unshift(lead)
    log('lead', lead.id, `New lead from ${lead.source}`)
    schedule(lead, 'call', `Call ${lead.name} – new inquiry`, new Date(Date.now() + 2 * 3_600_000).toISOString())
    enrollCampaigns('lead_created', lead)
    db.commit()
    return delay(lead)
  },
  update(id: string, patch: Partial<Lead>) {
    Object.assign(db.table('leads').find(l => l.id === id)!, patch)
    db.commit()
    return delay(true)
  },
  moveTo(id: string, status: LeadStatus) {
    const lead = db.table('leads').find(l => l.id === id)!
    if (lead.status === status) return delay(true)
    if (status === 'retained' || lead.status === 'retained') throw new Error('Use convert() to retain a lead')
    setStage(lead, status)
    db.commit()
    return delay(true)
  },
  remove(id: string) {
    const t = db.table('leads')
    t.splice(t.findIndex(l => l.id === id), 1)
    db.commit()
    return delay(true)
  },
  /** Lead -> Client: creates client + matter + draft retainer agreement + draft retainer invoice. */
  convert(id: string, opts: { matterTitle: string; retainerAmount: number }) {
    const lead = db.table('leads').find(l => l.id === id)!
    const client: Client = {
      id: uid('c'), name: lead.name, email: lead.email, phone: lead.phone,
      practiceArea: lead.practiceArea, status: 'active', leadId: lead.id, since: now(),
    }
    const matter: Matter = {
      id: uid('m'), clientId: client.id, title: opts.matterTitle, practiceArea: lead.practiceArea,
      status: 'open', attorney: lead.assignedTo, openedAt: now(),
    }
    // Carry over anything already sent to the lead during intake (engagement letter, retainer invoice)
    const leadDocs = db.table('documents').filter(d => d.leadId === lead.id)
    const leadInvs = db.table('invoices').filter(i => i.leadId === lead.id)
    leadDocs.forEach(d => { d.clientId = client.id })
    leadInvs.forEach(i => { i.clientId = client.id; i.matterId = matter.id })
    db.table('clients').unshift(client)
    db.table('matters').unshift(matter)
    if (!leadDocs.some(d => ENGAGEMENT_KINDS.includes(d.kind))) {
      db.table('documents').unshift({
        id: uid('d'), name: `Retainer Agreement – ${lead.name}`, kind: 'Retainer Agreement',
        recipientName: lead.name, recipientEmail: lead.email, clientId: client.id, status: 'draft', createdAt: now(),
      })
    }
    if (!leadInvs.some(i => i.type === 'retainer')) {
      db.table('invoices').unshift({
        id: uid('i'), number: nextInvoiceNumber(), clientId: client.id, matterId: matter.id, type: 'retainer',
        description: `Initial retainer – ${opts.matterTitle}`, amount: opts.retainerAmount, status: 'draft',
        dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      })
    }
    lead.status = 'retained'
    lead.clientId = client.id
    lead.lastContactAt = now()
    log('client', client.id, `${lead.name} converted from lead to client`)
    closeAutoItems(lead.id)
    db.table('agenda').filter(a => a.leadId === lead.id).forEach(a => { a.clientId = client.id })
    db.table('messages').filter(m => m.leadId === lead.id).forEach(m => { m.clientId = client.id })
    db.table('agenda').unshift({ id: uid('g'), type: 'meeting', title: `Case kickoff – ${client.name}`, dueAt: at(2, 10), done: false, assignedTo: lead.assignedTo, clientId: client.id, leadId: lead.id })
    enrollCampaigns('client_retained', lead)
    db.commit()
    return delay(client)
  },
}

// ---------- Clients & matters ----------
export const services = {
  list: () => delay(clone(db.table('services')).sort((a, b) => a.practiceArea.localeCompare(b.practiceArea) || a.name.localeCompare(b.name))),
  create(data: Omit<Service, 'id'>) {
    db.table('services').push({ ...data, id: uid('sv') })
    db.commit()
    return delay(true)
  },
  update(id: string, patch: Partial<Service>) {
    Object.assign(db.table('services').find(s => s.id === id)!, patch)
    db.commit()
    return delay(true)
  },
  /** Services already used by a lead can only be deactivated, not deleted. */
  remove(id: string) {
    if (db.table('leads').some(l => l.serviceId === id)) throw new Error('Service is in use. Deactivate it instead.')
    const t = db.table('services')
    t.splice(t.findIndex(s => s.id === id), 1)
    db.commit()
    return delay(true)
  },
}

export const clients = {
  list: () => delay(clone(db.table('clients')).sort((a, b) => b.since.localeCompare(a.since))),
  get: (id: string) => delay(clone(db.table('clients').find(c => c.id === id)!)),
  matters: (clientId?: string) =>
    delay(clone(db.table('matters')).filter(m => !clientId || m.clientId === clientId)),
  addMatter(data: Omit<Matter, 'id' | 'openedAt'>) {
    db.table('matters').unshift({ ...data, id: uid('m'), openedAt: now() })
    db.commit()
    return delay(true)
  },
  updateMatter(id: string, patch: Partial<Matter>) {
    Object.assign(db.table('matters').find(m => m.id === id)!, patch)
    db.commit()
    return delay(true)
  },
}

// ---------- Documents / e-signature ----------
export const documents = {
  list: () => delay(clone(db.table('documents')).sort(byNewest)),
  create(data: Pick<LegalDocument, 'name' | 'kind' | 'recipientName' | 'recipientEmail' | 'clientId' | 'leadId'>) {
    const doc: LegalDocument = { ...data, id: uid('d'), status: 'draft', createdAt: now() }
    db.table('documents').unshift(doc)
    db.commit()
    return delay(doc)
  },
  /** Mock of "send via e-sign provider" (DocuSign/Dropbox Sign etc. would plug in here). */
  send(id: string) {
    const d = db.table('documents').find(x => x.id === id)!
    d.status = 'sent'; d.sentAt = now()
    log('document', id, `${d.name} sent to ${d.recipientEmail} for signature`)
    addMessage({ channel: 'email', direction: 'out', leadId: d.leadId, clientId: d.clientId, subject: `Please sign: ${d.name}`, body: `Hi ${d.recipientName.split(' ')[0]}, your ${d.kind.toLowerCase()} is ready for signature.`, source: 'Documents' })
    if (ENGAGEMENT_KINDS.includes(d.kind)) advanceLead(d.leadId, 'engagement_sent')
    db.commit()
    return delay(true)
  },
  /** Mock provider webhook events. */
  simulate(id: string, status: 'viewed' | 'signed' | 'declined') {
    const d = db.table('documents').find(x => x.id === id)!
    d.status = status
    if (status === 'signed') d.signedAt = now()
    log('document', id, `${d.recipientName} ${status} ${d.name}`)
    if (d.leadId && status === 'signed' && ENGAGEMENT_KINDS.includes(d.kind)) log('lead', d.leadId, 'Engagement signed. Send the retainer payment link next.')
    db.commit()
    return delay(true)
  },
  remove(id: string) {
    const t = db.table('documents')
    t.splice(t.findIndex(d => d.id === id), 1)
    db.commit()
    return delay(true)
  },
}

// ---------- Invoices / payments ----------
export const invoices = {
  list: () => {
    const t = db.table('invoices')
    // derive overdue status
    t.forEach(i => { if (i.status === 'sent' && new Date(i.dueDate) < new Date()) i.status = 'overdue' })
    return delay(clone(t).sort((a, b) => b.number.localeCompare(a.number)))
  },
  create(data: Pick<Invoice, 'clientId' | 'leadId' | 'matterId' | 'type' | 'description' | 'amount' | 'dueDate'>) {
    const inv: Invoice = { ...data, id: uid('i'), number: nextInvoiceNumber(), status: 'draft' }
    db.table('invoices').unshift(inv)
    db.commit()
    return delay(inv)
  },
  /** Mock of generating + emailing a payment link (Stripe/LawPay would plug in here). */
  send(id: string) {
    const i = db.table('invoices').find(x => x.id === id)!
    i.status = 'sent'
    log('invoice', id, `${i.number} sent with payment link`)
    const payer = i.clientId ? db.table('clients').find(c => c.id === i.clientId) : db.table('leads').find(l => l.id === i.leadId)
    addMessage({ channel: 'email', direction: 'out', leadId: i.leadId, clientId: i.clientId, subject: `Payment link: ${i.number} – $${i.amount.toLocaleString()}`, body: `Hi ${(payer?.name ?? '').split(' ')[0]}, you can pay ${i.number} securely online.`, source: 'Payments' })
    if (i.type === 'retainer') advanceLead(i.leadId, 'payment_link_sent')
    db.commit()
    return delay(true)
  },
  markPaid(id: string, method = 'Card') {
    const i = db.table('invoices').find(x => x.id === id)!
    i.status = 'paid'; i.paidAt = now(); i.method = method
    log('invoice', id, `${i.number} paid – $${i.amount.toLocaleString()}`)
    if (i.leadId && i.type === 'retainer') log('lead', i.leadId, 'Retainer paid. Ready to retain as a client.')
    db.commit()
    return delay(true)
  },
  remove(id: string) {
    const t = db.table('invoices')
    t.splice(t.findIndex(d => d.id === id), 1)
    db.commit()
    return delay(true)
  },
}

// ---------- Campaigns ----------
export const campaigns = {
  list: () => delay(clone(db.table('campaigns')).sort(byNewest)),
  get: (id: string) => delay(clone(db.table('campaigns').find(c => c.id === id)!)),
  create(name: string, trigger: Campaign['trigger']) {
    const c: Campaign = {
      id: uid('cp'), name, trigger, status: 'draft', createdAt: now(),
      steps: [{ id: uid('s'), type: 'email', delayDays: 0, subject: 'Subject', body: 'Write your message…' }],
      stats: { enrolled: 0, sent: 0, opened: 0, replied: 0, converted: 0 },
    }
    db.table('campaigns').unshift(c)
    db.commit()
    return delay(c)
  },
  update(id: string, patch: Partial<Pick<Campaign, 'name' | 'trigger' | 'status' | 'steps'>>) {
    Object.assign(db.table('campaigns').find(c => c.id === id)!, patch)
    db.commit()
    return delay(true)
  },
  newStep: (): CampaignStep => ({ id: uid('s'), type: 'email', delayDays: 1, subject: '', body: '' }),
  remove(id: string) {
    const t = db.table('campaigns')
    t.splice(t.findIndex(d => d.id === id), 1)
    db.commit()
    return delay(true)
  },
}

// ---------- Activity & dashboard ----------
export const activity = {
  recent: (limit = 8) => delay(clone(db.table('activities')).sort(byNewest).slice(0, limit)),
  forEntity: (type: Activity['entityType'], id: string) =>
    delay(clone(db.table('activities')).filter(a => a.entityType === type && a.entityId === id).sort(byNewest)),
}

export const dashboard = {
  async stats() {
    const L = db.table('leads'), I = db.table('invoices'), D = db.table('documents'), C = db.table('clients')
    const open = L.filter(l => l.status !== 'retained' && l.status !== 'lost')
    const retained = L.filter(l => l.status === 'retained').length
    const closed = L.filter(l => l.status === 'retained' || l.status === 'lost').length
    return delay({
      openLeads: open.length,
      pipelineValue: open.reduce((s, l) => s + l.value, 0),
      conversionRate: closed ? Math.round((retained / closed) * 100) : 0,
      activeClients: C.filter(c => c.status === 'active').length,
      collected: I.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
      outstanding: I.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
      awaitingSignature: D.filter(d => d.status === 'sent' || d.status === 'viewed').length,
      overdueCount: I.filter(i => i.status === 'overdue').length,
      funnel: LEAD_STAGES.filter(s => s.key !== 'lost').map(s => ({ label: s.label, count: L.filter(l => l.status === s.key).length })),
    })
  },
}

// ---------- Agenda ----------
export const agenda = {
  list: () => delay(clone(db.table('agenda')).sort((a, b) => a.dueAt.localeCompare(b.dueAt))),
  create(data: Pick<AgendaItem, 'type' | 'title' | 'dueAt' | 'assignedTo' | 'leadId' | 'clientId' | 'notes'>) {
    const item: AgendaItem = { ...data, id: uid('g'), done: false }
    db.table('agenda').unshift(item)
    const who = data.leadId ? db.table('leads').find(l => l.id === data.leadId) : undefined
    if (who) log('lead', who.id, `${item.title} scheduled`)
    db.commit()
    return delay(item)
  },
  toggle(id: string) {
    const a = db.table('agenda').find(x => x.id === id)!
    a.done = !a.done
    a.completedAt = a.done ? now() : undefined
    if (a.done && a.leadId) {
      const lead = db.table('leads').find(l => l.id === a.leadId)
      if (lead) lead.lastContactAt = now()
    }
    db.commit()
    return delay(true)
  },
  reschedule(id: string, dueAt: string) {
    db.table('agenda').find(x => x.id === id)!.dueAt = dueAt
    db.commit()
    return delay(true)
  },
  remove(id: string) {
    const t = db.table('agenda')
    t.splice(t.findIndex(x => x.id === id), 1)
    db.commit()
    return delay(true)
  },
}

// ---------- Communication (mock send; plug email/SMS providers in here) ----------
export const communications = {
  list: () => delay(clone(db.table('messages')).sort((a, b) => b.at.localeCompare(a.at))),
  send(data: Pick<Message, 'channel' | 'leadId' | 'clientId' | 'subject' | 'body'>) {
    addMessage({ ...data, direction: 'out' })
    const lead = data.leadId ? db.table('leads').find(l => l.id === data.leadId) : undefined
    if (lead) { lead.lastContactAt = now(); log('lead', lead.id, `${data.channel === 'sms' ? 'Text' : 'Email'} sent to ${lead.name}`) }
    db.commit()
    return delay(true)
  },
}

// ---------- Reports ----------
export const reports = {
  summary(days: number) {
    const cutoff = days ? Date.now() - days * 86_400_000 : 0
    const inRange = (iso?: string) => !!iso && new Date(iso).getTime() >= cutoff
    const L = db.table('leads').filter(l => inRange(l.createdAt))
    const clients = db.table('clients'), invoices = db.table('invoices'), services = db.table('services')

    const group = (key: (l: Lead) => string) => {
      const m = new Map<string, { name: string; leads: number; retained: number; lost: number; pipeline: number }>()
      L.forEach(l => {
        const name = key(l) || '—'
        const g = m.get(name) ?? { name, leads: 0, retained: 0, lost: 0, pipeline: 0 }
        g.leads++
        if (l.status === 'retained') g.retained++
        else if (l.status === 'lost') g.lost++
        else g.pipeline += l.value
        m.set(name, g)
      })
      return [...m.values()].sort((a, b) => b.leads - a.leads)
    }

    const daysToRetain = L.filter(l => l.status === 'retained' && l.clientId).map(l => {
      const c = clients.find(x => x.id === l.clientId)!
      return Math.max(0, Math.round((new Date(c.since).getTime() - new Date(l.createdAt).getTime()) / 86_400_000))
    })

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short' }), amount: 0 }
    })
    invoices.filter(i => i.status === 'paid' && i.paidAt).forEach(i => {
      const d = new Date(i.paidAt!)
      const m = months.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`)
      if (m) m.amount += i.amount
    })

    const areaOfInvoice = (i: typeof invoices[number]) =>
      clients.find(c => c.id === i.clientId)?.practiceArea ?? db.table('leads').find(l => l.id === i.leadId)?.practiceArea ?? '—'
    const revenueByArea = new Map<string, number>()
    invoices.filter(i => i.status === 'paid').forEach(i => revenueByArea.set(areaOfInvoice(i), (revenueByArea.get(areaOfInvoice(i)) ?? 0) + i.amount))

    const retained = L.filter(l => l.status === 'retained').length
    const closed = L.filter(l => l.status === 'retained' || l.status === 'lost').length
    return delay({
      totals: {
        leads: L.length, retained, lost: L.filter(l => l.status === 'lost').length,
        conversion: closed ? Math.round((retained / closed) * 100) : 0,
        avgDaysToRetain: daysToRetain.length ? Math.round(daysToRetain.reduce((a, b) => a + b, 0) / daysToRetain.length) : 0,
        pipeline: L.filter(l => l.status !== 'retained' && l.status !== 'lost').reduce((s, l) => s + l.value, 0),
      },
      stages: LEAD_STAGES.map(s => ({ label: s.label, count: L.filter(l => l.status === s.key).length })),
      bySource: group(l => l.source),
      byArea: group(l => l.practiceArea),
      byService: group(l => services.find(s => s.id === l.serviceId)?.name ?? ''),
      byAttorney: group(l => l.assignedTo),
      revenueByMonth: months,
      revenueByArea: [...revenueByArea].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      money: {
        collected: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
        outstanding: invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) >= new Date()).reduce((s, i) => s + i.amount, 0),
        overdue: invoices.filter(i => i.status === 'overdue' || (i.status === 'sent' && new Date(i.dueDate) < new Date())).reduce((s, i) => s + i.amount, 0),
      },
      campaigns: db.table('campaigns').filter(c => c.stats.enrolled > 0).map(c => ({ name: c.name, ...c.stats })),
    })
  },
}

// ---------- Global search ----------
export interface SearchHit { group: string; title: string; subtitle: string; to: string }

export const search = {
  query(q: string) {
    const term = q.trim().toLowerCase()
    if (!term) return delay([] as SearchHit[], 0)
    const has = (...f: (string | undefined)[]) => f.some(x => x?.toLowerCase().includes(term))
    const leadName = (id?: string) => db.table('leads').find(l => l.id === id)?.name ?? ''
    const clientName = (id?: string) => db.table('clients').find(c => c.id === id)?.name ?? ''
    const hits: SearchHit[] = []
    db.table('leads').filter(l => has(l.name, l.email, l.phone, l.practiceArea, l.source, l.notes))
      .forEach(l => hits.push({ group: 'Leads', title: l.name, subtitle: `${l.practiceArea} · ${LEAD_STAGES.find(s => s.key === l.status)!.label}`, to: l.clientId ? `/clients/${l.clientId}` : `/pipeline?lead=${l.id}` }))
    db.table('clients').filter(c => has(c.name, c.email, c.phone, c.company))
      .forEach(c => hits.push({ group: 'Clients', title: c.name, subtitle: `${c.practiceArea} · ${c.email}`, to: `/clients/${c.id}` }))
    db.table('matters').filter(m => has(m.title, m.attorney))
      .forEach(m => hits.push({ group: 'Matters', title: m.title, subtitle: `${clientName(m.clientId)} · ${m.attorney}`, to: `/clients/${m.clientId}` }))
    db.table('agenda').filter(a => has(a.title, a.notes))
      .forEach(a => hits.push({ group: 'Agenda', title: a.title, subtitle: `${new Date(a.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${a.assignedTo}${a.done ? ' · done' : ''}`, to: '/agenda' }))
    db.table('messages').filter(m => has(m.subject, m.body))
      .forEach(m => hits.push({ group: 'Communication', title: m.subject ?? m.body.slice(0, 60), subtitle: `${m.channel === 'email' ? 'Email' : 'Text'} · ${clientName(m.clientId) || leadName(m.leadId)}`, to: '/communication' }))
    db.table('documents').filter(d => has(d.name, d.recipientName, d.recipientEmail, d.kind))
      .forEach(d => hits.push({ group: 'Documents', title: d.name, subtitle: `${d.status} · ${d.recipientName}`, to: '/documents' }))
    db.table('invoices').filter(i => has(i.number, i.description))
      .forEach(i => hits.push({ group: 'Payments', title: `${i.number} · ${i.description}`, subtitle: `$${i.amount.toLocaleString()} · ${i.status}`, to: '/payments' }))
    db.table('campaigns').filter(c => has(c.name))
      .forEach(c => hits.push({ group: 'Marketing', title: c.name, subtitle: `${c.status} · ${c.steps.length} steps`, to: `/marketing/${c.id}` }))
    db.table('services').filter(s => has(s.name, s.practiceArea, s.description))
      .forEach(s => hits.push({ group: 'Services', title: s.name, subtitle: s.practiceArea, to: '/services' }))
    return delay(hits)
  },
}
