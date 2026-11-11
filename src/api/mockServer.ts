// In-memory stand-in for the backend: holds the tables and the business rules (stage moves, automations,
// campaign sends). Replace ./index.ts with real HTTP calls when the backend is ready; nothing in the UI
// imports this file.
import { toast } from '../shared/toast'
import * as seed from './mockData'
import { DAY, HOUR, config } from './mockData'
import type {
  Activity, Task, AudienceKey, Campaign, Firm, FirmEvent, Integration, Lead, NewCampaignInput, NewLeadInput,
  PortalDocument, Recipient, SendProgress, SentItem, Service, SourceId, StageId,
} from './types'

interface Tables {
  leads: Lead[]
  tasks: Task[]
  events: FirmEvent[]
  integrations: Integration[]
  campaigns: Campaign[]
  documents: PortalDocument[]
  services: Service[]
  firm: Firm
  sending: SendProgress | null
}

const build = (): Tables => {
  const leads = seed.leads()
  return { leads, tasks: seed.tasks(), events: seed.firmEvents(), integrations: seed.integrations(), campaigns: seed.campaigns(leads), documents: seed.documents(), services: seed.services(), firm: seed.firm(), sending: null }
}
// The mock backend keeps its tables in localStorage so a refresh does not lose work; "Reset Sample Data" clears it.
const KEY = 'unir-portal-mock-v4' // v4: added the services catalog and the Payment Pending stage
const load = (): Tables => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const x = JSON.parse(raw) as Tables; if (x.leads && x.tasks && x.firm && x.documents && x.services) return { ...x, sending: null } }
  } catch { /* unavailable or corrupt: start from the seed */ }
  return build()
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* storage full or blocked */ } }
let t: Tables = load()
let version = 0
const listeners = new Set<() => void>()
export const store = {
  get: () => t,
  version: () => version,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  commit() { version++; save(); listeners.forEach(l => l()) },
  reset() { t = build(); store.commit() },
}

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9)
export const first = (n: string) => n.split(' ')[0]
const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, '.')
const STAGE = Object.fromEntries(config.stages.map((s, i) => [s.id, { ...s, i }])) as Record<string, { id: StageId; label: string; next: string; i: number }>
export const isWon = (l: Lead) => l.stage === 'signed' || l.stage === 'payment' || l.stage === 'delivered'
export const canText = () => t.firm.textStatus === 'registered'
export const canEmail = () => t.firm.domainStatus === 'verified'
const findLead = (id: string) => { const l = t.leads.find(x => x.id === id); if (!l) throw new Error(`Lead ${id} not found`); return l }
const log = (l: Lead, a: Partial<Activity> & Pick<Activity, 'type' | 'title'>) => { l.activities.push({ t: Date.now(), cls: '', ...a }) }
const quoteOf = (s: string) => { const x = s.replace(/\s+/g, ' '); return x.length > 140 ? x.slice(0, 140).replace(/[\s.,]+$/, '') + '…' : x }

/* ---------- tasks: every stage books its next step ---------- */
const STEP: Partial<Record<StageId, { due: (now: number) => number; type: Task['type'] }>> = {
  new: { due: n => n + HOUR, type: 'call' },
  contacted: { due: n => n + DAY, type: 'meeting' },
  consult: { due: n => n + 2 * DAY, type: 'task' },
  contract: { due: n => n + 2 * DAY, type: 'follow_up' },
  payment: { due: n => n + 3 * DAY, type: 'follow_up' },
}
function rebookNextStep(l: Lead) {
  const now = Date.now()
  t.tasks.forEach(a => { if (a.leadId === l.id && a.auto && !a.done) { a.done = true; a.completedAt = now } })
  const step = STEP[l.stage]
  if (step) t.tasks.unshift({ id: uid('g'), type: step.type, title: STAGE[l.stage].next, dueAt: step.due(now), done: false, assignedTo: l.owner, leadId: l.id, auto: true })
}

/* ---------- automations ---------- */
const fill = (s: string, l: Lead | null) => s.replace(/\{first\}/g, l ? first(l.name) : 'Rachel').replace(/\{matter\}/g, l ? l.matter.toLowerCase() : 'custody question').replace(/\{firm\}/g, t.firm.name)

function fire(trigger: string, l: Lead) {
  t.campaigns.filter(c => c.kind === 'auto' && c.active && c.trigger === trigger).forEach(c => {
    const body = c.body.replace('{first}', first(l.name)).replace('{matter}', l.matter.toLowerCase())
    if (/Text/.test(c.channel)) {
      c.recipients.unshift({ id: l.id, name: l.name, channel: 'Text', status: canText() ? 'delivered' : 'held', at: Date.now() })
      if (canText()) { c.sent++; log(l, { type: 'text', cls: 'auto', title: `${c.name} text sent`, text: `From ${t.firm.number}, automatically.`, quote: body }); toast(`Text sent to ${first(l.name)}`, `From ${t.firm.number} by ${c.name}`) }
      else log(l, { type: 'text', cls: 'bad', title: `${c.name} text held`, text: 'Register your texting number in Settings to send it.' })
    }
    if (/Email/.test(c.channel)) {
      c.recipients.unshift({ id: l.id, name: l.name, channel: 'Email', status: canEmail() ? 'delivered' : 'held', at: Date.now() })
      if (canEmail()) { c.sent++; log(l, { type: 'email', cls: 'auto', title: `${c.name} email sent`, text: `From intake@${t.firm.domain}, automatically.`, quote: quoteOf(body) }) }
      else log(l, { type: 'email', cls: 'bad', title: `${c.name} email held`, text: 'Verify your email domain in Settings to send it.' })
    }
  })
}

/* ---------- leads ---------- */
export function createLead(channel: SourceId, data?: NewLeadInput): Lead {
  const used = new Set(t.leads.map(l => l.name))
  const fallback = seed.enquiryPool[t.leads.length % seed.enquiryPool.length]
  const p = data ?? seed.enquiryPool.find(x => !used.has(x.name)) ?? { ...fallback, name: `${fallback.name} ${t.leads.length + 1}` }
  const phone = (data && data.phone) || `(555) 01${Math.floor(Math.random() * 10)}-${Math.floor(Math.random() * 9000 + 1000)}`
  const l: Lead = {
    id: uid('l'), name: p.name, email: `${slug(p.name)}@example.com`, phone, matter: p.matter, practice: p.practice, value: +(p.value ?? 0) || 0,
    source: channel, stage: 'new', owner: config.owners[t.leads.length % 4], created: Date.now(), activities: [], doc: null, lostReason: null,
    notes: (data && 'note' in data ? data.note : undefined)?.trim() || undefined,
  }
  const how = { web: 'Submitted the enquiry form on your website.', email: `Emailed intake@${t.firm.domain}.`, text: `Texted ${t.firm.number}.`, manual: 'Logged by staff with Quick Intake.', referral: 'Referred by a client.', ads: 'Came from a Google Ads lead form.' }[channel]
  const note = data && 'note' in data ? data.note : undefined
  const canned = { web: `I need help with my ${p.matter.toLowerCase()}. Can someone call me?`, email: `Hello, I am looking for advice about a ${p.matter.toLowerCase()}.`, text: `Hi, do you handle ${p.practice.toLowerCase()}? I need to talk to someone.`, manual: '', referral: '', ads: '' }[channel]
  const quote = note?.trim() || canned
  log(l, { type: 'enquiry', title: 'Enquiry received', text: how, quote: quote || undefined })
  log(l, { type: 'auto', cls: 'auto', title: `Lead created and assigned to ${l.owner}`, text: 'Next step booked: call within the hour.' })
  t.leads.unshift(l)
  rebookNextStep(l)
  if (channel !== 'manual') fire('A new enquiry arrives', l)
  toast(`New enquiry from ${l.name}`, `${config.sources[channel]}, ${l.practice.toLowerCase()}`)
  return l
}

export function setStage(l: Lead, stage: StageId, quiet = false) {
  if (l.stage === stage) return
  const from = l.stage
  l.stage = stage
  if (stage !== 'lost') l.lostReason = null
  if (stage !== 'lost') log(l, { type: 'stage', cls: isWon(l) ? 'good' : '', title: `Moved to ${STAGE[stage].label}`, text: `Next step booked: ${STAGE[stage].next.toLowerCase()}.` })
  // Services provided = success: the lead becomes a contact (Contacts and Leads never share a record)
  if (stage === 'delivered') log(l, { type: 'stage', cls: 'good', title: 'Became a contact', text: 'Services provided: moved from Leads to Contacts.' })
  else if (from === 'delivered') log(l, { type: 'stage', title: 'Returned to Leads', text: 'Moved back from Contacts.' })
  if (stage === 'payment') {
    const mine = serviceList(l), due = paymentDue(mine)
    log(l, { type: 'stage', cls: 'auto', title: 'Payment requested', text: mine.length ? `${due > 0 ? usd(due) : 'No upfront payment'} for ${mine.map(s => s.name).join(', ')}.` : 'Payment requested.' })
  }
  if (stage === 'consult') fire('A consultation is booked', l)
  if (stage === 'signed') fire('A client is signed', l)
  if (stage === 'contract' && (!l.doc || l.doc.status !== 'sent')) sendContract(l, true)
  rebookNextStep(l)
  if (!quiet) toast(`${l.name} moved to ${stage === 'lost' ? 'Lost' : STAGE[stage].label}`, from === 'lost' ? 'Lead reopened' : stage === 'delivered' ? 'Now a contact, moved from Leads to Contacts' : from === 'delivered' ? 'Back in Leads' : 'Next step added to Tasks')
}

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const serviceList = (l: Lead): Service[] => (l.serviceIds ?? []).map(id => t.services.find(s => s.id === id)).filter((s): s is Service => !!s)
/** What to request at Payment Pending: the retainers, or the whole estimated fee when the services have none. */
const paymentDue = (list: Service[]) => { const r = list.reduce((a, s) => a + s.retainer, 0); return r > 0 ? r : list.reduce((a, s) => a + seed.defaultFee(s), 0) }

/** Records which services the client is taking after the consultation; their default prices make up the estimated fee. */
export function setServices(l: Lead, ids: string[]) {
  const known = ids.filter(id => t.services.some(s => s.id === id))
  l.serviceIds = known
  const list = serviceList(l)
  l.value = list.reduce((a, s) => a + seed.defaultFee(s), 0)
  log(l, { type: 'stage', cls: '', title: known.length ? 'Services selected' : 'Services cleared', text: known.length ? `${list.map(s => s.name).join(', ')}. Estimated fee ${usd(l.value)}.` : 'No services on this ticket.' })
  toast(known.length ? `${known.length} ${known.length === 1 ? 'service' : 'services'} added` : 'Services cleared', known.length ? `Estimated fee ${usd(l.value)}` : undefined)
}

/**
 * Sends a packet of documents to the lead for signature and moves it to Contract Sent.
 * Without `items` it sends the engagement letter on its own (used by automatic paths such as the guided tour).
 */
export function sendContract(l: Lead, fromStage = false, items?: SentItem[]) {
  const packet: SentItem[] = items?.length ? items : [{ templateId: 'd1', name: 'Engagement Letter', values: {} }]
  l.doc = { status: 'sent', sent: Date.now(), items: packet }
  const ch = [canEmail() ? 'email' : null, canText() ? 'text link' : null].filter(Boolean).join(' and ') || 'link, held until sending is set up in Settings'
  const names = packet.map(i => i.name)
  log(l, { type: 'doc', cls: 'auto', title: packet.length > 1 ? `${packet.length} documents sent for signature` : `${names[0]} sent for signature`, text: `${packet.length > 1 ? names.join(', ') + '. ' : ''}Sent by ${ch}.` })
  if (!fromStage) { l.stage = 'contract'; log(l, { type: 'stage', title: 'Moved to Contract Sent', text: 'Next step booked: waiting for signature.' }); rebookNextStep(l) }
  toast(packet.length > 1 ? `${packet.length} documents sent to ${first(l.name)}` : `${names[0]} sent to ${first(l.name)}`, 'Lead moved to Contract Sent')
}

/** Hands the sent documents to the e-signature provider. Mock only: the external API will report the signature back (see signContract). */
export function requestSignature(l: Lead) {
  if (!l.doc) return
  log(l, { type: 'doc', cls: 'auto', title: 'Sent for signature', text: `Waiting for ${first(l.name)} to sign.` })
  toast(`Sent to ${first(l.name)} for signature`, 'The ticket moves to Signed once they sign')
}

export function signContract(l: Lead, by: string) {
  if (!l.doc) return
  l.doc.status = 'signed'; l.doc.signed = Date.now(); l.doc.by = by
  log(l, { type: 'signed', cls: 'good', title: `Signed by ${by}`, text: 'E-signature completed. Stage updated automatically.' })
  l.stage = 'signed'
  rebookNextStep(l)
  log(l, { type: 'stage', cls: 'good', title: 'Moved to Signed', text: 'Next step booked: request the retainer payment.' })
  fire('A client is signed', l)
  toast(`${l.name} signed`, 'Stage updated to Signed automatically')
}

export function logCall(l: Lead) {
  log(l, { type: 'call', title: `Call logged by ${l.owner}`, text: `Spoke with ${first(l.name)} about the ${l.matter.toLowerCase()}.` })
  setStage(l, 'contacted', true)
  toast(`Call logged with ${first(l.name)}`, 'Moved to Contacted, consultation step booked')
}

export function markLost(l: Lead, reason: string) {
  l.lostReason = reason
  setStage(l, 'lost', true)
  log(l, { type: 'lost', cls: 'bad', title: 'Marked as lost', text: `Reason: ${reason}.` })
  fire('A lead is marked as lost', l)
  toast(`${l.name} marked as lost`, reason)
}

export function sendText(l: Lead, body: string) {
  if (canText()) { log(l, { type: 'text', title: `Text sent by ${l.owner}`, text: `From ${t.firm.number}.`, quote: body }); toast(`Text sent to ${first(l.name)}`, `From ${t.firm.number}`) }
  else { log(l, { type: 'text', cls: 'bad', title: 'Text held', text: 'Your texting number is not registered yet.', quote: body }); toast('Text held', 'Register your number in Settings') }
}

/* ---------- campaigns ---------- */
export const audience = (key: AudienceKey, leads = t.leads): Lead[] => leads.filter({
  open: (l: Lead) => !['signed', 'payment', 'delivered', 'lost'].includes(l.stage),
  consult: (l: Lead) => l.stage === 'contacted' || l.stage === 'consult',
  clients: (l: Lead) => l.stage === 'signed' || l.stage === 'payment' || l.stage === 'delivered',
  lost: (l: Lead) => l.stage === 'lost',
  all: () => true,
}[key])

export const campaignStats = (c: Campaign) => {
  const r = c.recipients
  return {
    sent: r.filter(x => x.status === 'delivered').length, held: r.filter(x => x.status === 'held').length, skipped: r.filter(x => x.status === 'skipped').length,
    opened: r.filter(x => x.opened).length, replied: r.filter(x => x.replied).length, email: r.filter(x => x.channel === 'Email' && x.status === 'delivered').length,
  }
}

export function createCampaign(d: NewCampaignInput): Campaign {
  const c: Campaign = { id: uid('c'), kind: d.kind, name: d.name, channel: d.channel, steps: 1, sent: 0, subject: /Email/.test(d.channel) ? d.subject : '', body: d.body, recipients: [] }
  if (d.kind === 'auto') {
    c.trigger = d.trigger; c.active = true
    t.campaigns.push(c)
    toast(`${c.name} is on`, `Sends when ${d.trigger!.charAt(0).toLowerCase() + d.trigger!.slice(1)}`)
  } else {
    c.audience = d.audience
    t.campaigns.unshift(c)
    sendBroadcast(c)
  }
  return c
}

function sendBroadcast(c: Campaign) {
  const people = audience(c.audience!)
  t.sending = { id: c.id, total: people.length, done: 0 }
  const REPLIES = ['Yes, please call me tomorrow.', 'Thanks, I will book a time.', 'Can we talk next week?']
  let i = 0
  const step = () => {
    const l = people[i]
    const chans: Recipient['channel'][] = c.channel === 'Text and Email' ? ['Text', 'Email'] : [c.channel as Recipient['channel']]
    chans.forEach(ch => {
      const ok = ch === 'Text' ? canText() : canEmail()
      const r: Recipient = { id: l.id, name: l.name, channel: ch, status: l.optedOut ? 'skipped' : ok ? 'delivered' : 'held', at: Date.now() }
      if (r.status === 'delivered') {
        c.sent++
        r.opened = ch === 'Email' && Math.random() < 0.65
        r.replied = Math.random() < 0.25
        const body = fill(c.body, l) + (ch === 'Text' && !/\bSTOP\b/i.test(c.body) ? ' Reply STOP to opt out.' : '')
        log(l, { type: ch === 'Text' ? 'text' : 'email', cls: 'auto', title: `${c.name} ${ch === 'Text' ? 'text' : 'email'} sent`, text: `From ${ch === 'Text' ? t.firm.number : 'intake@' + t.firm.domain}, one-off campaign.`, quote: body.length > 140 ? body.slice(0, 140) + '…' : body })
        if (r.replied) log(l, { type: ch === 'Text' ? 'text' : 'email', title: `Reply from ${first(l.name)}`, text: `Replied to ${c.name}.`, quote: REPLIES[i % REPLIES.length] })
      }
      c.recipients.push(r)
    })
    i++
    t.sending = { id: c.id, total: people.length, done: i }
    if (i < people.length) { store.commit(); setTimeout(step, 420) }
    else {
      c.sentAt = Date.now(); t.sending = null
      const st = campaignStats(c)
      toast(`${c.name} sent`, `${st.sent} delivered${st.held ? `, ${st.held} held` : ''}${st.skipped ? `, ${st.skipped} skipped` : ''}`)
      store.commit()
    }
  }
  setTimeout(step, 300)
}

/* ---------- firm setup ---------- */
export function verifyDomain() {
  t.firm.domainStatus = 'pending'
  store.commit()
  setTimeout(() => { t.firm.domainStatus = 'verified'; toast('Email domain verified', `Emails now send from intake@${t.firm.domain}`); store.commit() }, 1500)
}
export function approveTexting() { t.firm.textStatus = 'registered'; toast('Texting number registered', `Texts now send from ${t.firm.number}`) }
export { findLead, fill, STAGE }
