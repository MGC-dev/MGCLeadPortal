// Endpoint layer used by the UI. Every function is async and returns plain data, like a real HTTP client would.
// Today they call the in-memory mock backend (mockServer.ts, seeded from mockData.ts). When the real backend
// is ready, replace each body with a fetch() call; the signatures and the types in ./types.ts stay the same.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { config as seedConfig, enquiryPool, team as seedTeam } from './mockData'
import * as srv from './mockServer'
import { store } from './mockServer'
import { toast } from '../shared/toast' // mock-only: a real backend would not toast, the UI would
import type {
  Task, AudienceKey, Campaign, PortalConfig, Firm, FirmEvent, Integration, Lead, NewCampaignInput, NewLeadInput,
  DocFile, DocField, PortalDocument, SearchHit, Service, SendProgress, SentItem, SourceId, StageId, TeamMember,
} from './types'

const clone = <T,>(v: T): T => structuredClone(v)
const reply = <T,>(v: T): Promise<T> => Promise.resolve(clone(v))
const done = () => { store.commit(); return Promise.resolve() }

export const configApi = {
  get: (): Promise<PortalConfig> => reply(seedConfig),
}

export const leadsApi = {
  list: (): Promise<Lead[]> => reply(store.get().leads),
  get: (id: string): Promise<Lead | undefined> => reply(store.get().leads.find(l => l.id === id)),
  /** Simulates an enquiry arriving by a channel, or staff logging one with Quick Intake. */
  create(channel: SourceId, data?: NewLeadInput): Promise<Lead> { const l = srv.createLead(channel, data); store.commit(); return reply(l) },
  setStage(id: string, stage: StageId) { srv.setStage(srv.findLead(id), stage); return done() },
  logCall(id: string) { srv.logCall(srv.findLead(id)); return done() },
  sendContract(id: string) { srv.sendContract(srv.findLead(id)); return done() },
  /** Sends a packet of library documents (with their inputs filled from the ticket) and moves the lead to Contract Sent. */
  sendDocuments(id: string, items: SentItem[]) { srv.sendContract(srv.findLead(id), false, items); return done() },
  /** The services the client is taking (from the catalog); sets the ticket's estimated fee. */
  setServices(id: string, ids: string[]) { srv.setServices(srv.findLead(id), ids); return done() },
  /** Sends the already-approved documents for signature. No modal; the stage changes when the e-signature API reports back. */
  sendForSignature(id: string) { srv.requestSignature(srv.findLead(id)); return done() },
  sign(id: string, by: string) { srv.signContract(srv.findLead(id), by); return done() },
  markLost(id: string, reason: string) { srv.markLost(srv.findLead(id), reason); return done() },
  sendText(id: string, body: string) { srv.sendText(srv.findLead(id), body); return done() },
  addReminder(id: string, title: string, inHours: number) { return tasksApi.create({ type: 'follow_up', title, dueAt: Date.now() + inHours * 3_600_000, assignedTo: srv.findLead(id).owner, leadId: id }) },
}

export const tasksApi = {
  list: (): Promise<Task[]> => reply([...store.get().tasks].sort((a, b) => a.dueAt - b.dueAt)),
  create(data: Pick<Task, 'type' | 'title' | 'dueAt' | 'assignedTo' | 'leadId' | 'notes'>) {
    const item: Task = { ...data, id: srv.uid('g'), done: false }
    store.get().tasks.unshift(item)
    const l = data.leadId ? store.get().leads.find(x => x.id === data.leadId) : undefined
    if (l) l.activities.push({ t: Date.now(), type: 'reminder', cls: '', title: `Scheduled: ${item.title}`, text: `Due ${new Date(item.dueAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}, on ${item.assignedTo}’s task list.` })
    return done()
  },
  toggle(id: string) {
    const a = store.get().tasks.find(x => x.id === id)
    if (!a) return Promise.resolve()
    a.done = !a.done
    a.completedAt = a.done ? Date.now() : undefined
    const l = a.leadId ? store.get().leads.find(x => x.id === a.leadId) : undefined
    if (a.done && l) { l.activities.push({ t: Date.now(), type: 'stage', cls: 'good', title: `Task done: ${a.title}`, text: `Ticked off by ${a.assignedTo}.` }); toast('Task done', `${a.title}, ${l.name}`) }
    return done()
  },
  reschedule(id: string, dueAt: number) { const a = store.get().tasks.find(x => x.id === id); if (a) a.dueAt = dueAt; return done() },
  remove(id: string) { const t = store.get(); t.tasks = t.tasks.filter(x => x.id !== id); return done() },
}

export interface DocumentInput { name: string; category: PortalDocument['category']; description: string; file: DocFile | null; fields: DocField[]; active: boolean }
export const documentsApi = {
  list: (): Promise<PortalDocument[]> => reply([...store.get().documents].sort((a, b) => b.updatedAt - a.updatedAt)),
  get: (id: string): Promise<PortalDocument | undefined> => reply(store.get().documents.find(d => d.id === id)),
  /** Creates an empty draft; it becomes available when sending once it has a file and is switched on. */
  create(): Promise<PortalDocument> {
    const now = Date.now()
    const d: PortalDocument = { id: srv.uid('d'), name: 'Untitled document', category: 'Other', description: '', file: null, fields: [], active: false, createdAt: now, updatedAt: now, updatedBy: 'Sarah Mitchell' }
    store.get().documents.unshift(d); store.commit()
    return reply(d)
  },
  update(id: string, input: DocumentInput) {
    const d = store.get().documents.find(x => x.id === id)
    if (d) { Object.assign(d, input, { updatedAt: Date.now(), updatedBy: 'Sarah Mitchell', active: input.active && !!input.file }); toast('Document saved', d.name) }
    return done()
  },
  remove(id: string) { const t = store.get(); const d = t.documents.find(x => x.id === id); t.documents = t.documents.filter(x => x.id !== id); if (d) toast('Document deleted', d.name); return done() },
}

export interface ServiceInput { name: string; practice: string; description: string; pricingModel: Service['pricingModel']; price: number; retainer: number; active: boolean }
/** The services catalog: everything the firm provides, with default pricing. */
export const servicesApi = {
  list: (): Promise<Service[]> => reply([...store.get().services].sort((a, b) => a.practice.localeCompare(b.practice) || a.name.localeCompare(b.name))),
  get: (id: string): Promise<Service | undefined> => reply(store.get().services.find(s => s.id === id)),
  /** Creates a blank service (switched off until it is set up). */
  create(): Promise<Service> {
    const now = Date.now()
    const s: Service = { id: srv.uid('sv'), name: 'New service', practice: seedConfig.practiceAreas[0], description: '', pricingModel: 'flat', price: 0, retainer: 0, active: false, createdAt: now, updatedAt: now }
    store.get().services.unshift(s); store.commit()
    return reply(s)
  },
  update(id: string, input: ServiceInput) {
    const s = store.get().services.find(x => x.id === id)
    if (s) { Object.assign(s, input, { updatedAt: Date.now() }); toast('Service saved', s.name) }
    return done()
  },
  remove(id: string) { const t = store.get(); const s = t.services.find(x => x.id === id); t.services = t.services.filter(x => x.id !== id); if (s) toast('Service deleted', s.name); return done() },
}

export const eventsApi = { list: (): Promise<FirmEvent[]> => reply(store.get().events) }

export const campaignsApi = {
  list: (): Promise<Campaign[]> => reply(store.get().campaigns),
  create(d: NewCampaignInput) { const c = srv.createCampaign(d); store.commit(); return reply(c) },
  toggle(id: string) {
    const c = store.get().campaigns.find(x => x.id === id)
    if (c) { c.active = !c.active; toast(`${c.name} ${c.active ? 'turned on' : 'turned off'}`) }
    return done()
  },
  /** How many leads a one-off send to this audience would reach (opted-out contacts are skipped). */
  audience: (key: AudienceKey): Promise<{ total: number; optedOut: number; sample?: Lead }> => {
    const people = srv.audience(key)
    return reply({ total: people.length, optedOut: people.filter(l => l.optedOut).length, sample: people.find(l => !l.optedOut) ?? store.get().leads[0] })
  },
  progress: (): Promise<SendProgress | null> => reply(store.get().sending),
}

export const firmApi = {
  get: (): Promise<Firm> => reply(store.get().firm),
  verifyDomain() { srv.verifyDomain(); return Promise.resolve() },
  submitTexting() { store.get().firm.textStatus = 'review'; toast('Registration submitted', 'Carriers usually take days to weeks'); return done() },
  approveTexting() { srv.approveTexting(); return done() },
  team: (): Promise<TeamMember[]> => reply(seedTeam),
}

export const integrationsApi = {
  list: (): Promise<Integration[]> => reply(store.get().integrations),
  toggle(id: string) {
    const x = store.get().integrations.find(i => i.id === id)
    if (x) { x.on = !x.on; toast(`${x.name} ${x.on ? 'connected' : 'disconnected'}`, x.on ? 'Sample mode, no account is linked' : undefined) }
    return done()
  },
}

/** Searches everything the portal holds. A real backend should do this server-side. */
export const searchApi = {
  query(q: string): Promise<SearchHit[]> {
    const term = q.trim().toLowerCase()
    if (!term) return Promise.resolve([])
    const has = (...f: (string | undefined)[]) => f.some(x => x?.toLowerCase().includes(term))
    const t = store.get()
    const hits: SearchHit[] = []
    t.leads.filter(l => has(l.name, l.email, l.phone, l.matter, l.practice, l.owner))
      .forEach(l => hits.push({ group: 'Leads', title: l.name, subtitle: `${l.matter} · ${l.practice}`, target: { type: 'lead', id: l.id } }))
    t.tasks.filter(a => has(a.title, a.notes, a.assignedTo))
      .forEach(a => hits.push({ group: 'Tasks', title: a.title, subtitle: `${new Date(a.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${a.assignedTo}${a.done ? ' · done' : ''}`, target: { type: 'tasks', id: a.id } }))
    t.leads.forEach(l => l.activities.filter(a => (a.type === 'text' || a.type === 'email') && has(a.title, a.quote, a.text))
      .slice(-2).forEach(a => hits.push({ group: 'Messages', title: a.title, subtitle: `${l.name}${a.quote ? ' · ' + a.quote.slice(0, 60) : ''}`, target: { type: 'lead', id: l.id } })))
    t.documents.filter(d => has(d.name, d.description, d.category, d.file?.name))
      .forEach(d => hits.push({ group: 'Documents', title: d.name, subtitle: `${d.category} · ${d.file?.name ?? 'No file yet'}`, target: { type: 'document', id: d.id } }))
    t.services.filter(s => has(s.name, s.description, s.practice))
      .forEach(s => hits.push({ group: 'Services', title: s.name, subtitle: `${s.practice} · ${s.active ? 'Active' : 'Inactive'}`, target: { type: 'service', id: s.id } }))
    t.campaigns.filter(c => has(c.name, c.body, c.subject))
      .forEach(c => hits.push({ group: 'Campaigns', title: c.name, subtitle: `${c.kind === 'auto' ? 'Automatic' : 'One-off'} · ${c.channel}`, target: { type: 'campaign', id: c.id } }))
    return reply(hits.slice(0, 40))
  },
}

export const systemApi = { reset() { store.reset(); toast('Sample data reset'); return Promise.resolve() } }

export { enquiryPool }

/** Re-runs an endpoint whenever any data changes. Keeps the previous result while reloading. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const version = useSyncExternalStore(store.subscribe, store.version)
  const [data, setData] = useState<T>()
  useEffect(() => {
    let live = true
    fn().then(d => { if (live) setData(d) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])
  return data
}
