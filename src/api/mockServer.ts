// In-memory stand-in for the backend: holds the tables and the business rules (stage moves, automations,
// campaign sends). Replace ./index.ts with real HTTP calls when the backend is ready; nothing in the UI
// imports this file.
import { toast } from '../shared/toast'
import * as seed from './mockData'
import { DAY, HOUR, config } from './mockData'
import type {
  Activity, Bot, BotAction, BotTool, ChatAction, ChatConversation, Task, AudienceKey, Campaign, CampaignTag, Firm, FirmEvent, Integration, Lead, NewCampaignInput, NewLeadInput,
  PortalDocument, Recipient, SendProgress, SentItem, Service, SourceId, StageId,
} from './types'
// The mock backend fills a campaign's inputs the way a real one would on send: from the ticket, the firm or the date
import { prefillValue } from '../modules/documents/documentFields'

interface Tables {
  leads: Lead[]
  tasks: Task[]
  events: FirmEvent[]
  integrations: Integration[]
  campaigns: Campaign[]
  documents: PortalDocument[]
  services: Service[]
  bots: Bot[]
  conversations: ChatConversation[]
  firm: Firm
  sending: SendProgress | null
}

const build = (): Tables => {
  const leads = seed.leads()
  return { leads, tasks: seed.tasks(), events: seed.firmEvents(), integrations: seed.integrations(), campaigns: seed.campaigns(leads), documents: seed.documents(), services: seed.services(), bots: seed.bots(), conversations: seed.conversations(seed.bots()), firm: seed.firm(), sending: null }
}
// The mock backend keeps its tables in localStorage so a refresh does not lose work; "Reset Sample Data" clears it.
const KEY = 'unir-portal-mock-v12' // v4: added the services catalog and the Payment Pending stage
const load = (): Tables => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const x = JSON.parse(raw) as Tables; if (x.leads && x.tasks && x.firm && x.documents && x.services && x.bots && x.conversations) return { ...x, sending: null, conversations: x.conversations.map(c => ({ ...c, pending: false })) } }
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
const fill = (s: string, l: Lead | null, tags: CampaignTag[] = []) => {
  let out = s.replace(/\{first\}/g, l ? first(l.name) : 'Rachel').replace(/\{matter\}/g, l ? l.matter.toLowerCase() : 'custody question').replace(/\{firm\}/g, t.firm.name)
  for (const g of tags) {
    const names = l ? (l.serviceIds ?? []).map(id => t.services.find(x => x.id === id)?.name).filter(Boolean).join(', ') : ''
    out = out.split(`{${g.id}}`).join(l ? prefillValue({ id: g.id, label: g.label, source: g.source, kind: 'text' }, l, t.firm.name, names) : g.label)
  }
  return out
}

/** The campaign trigger for a ticket reaching a stage, e.g. "A ticket moves to Signed". */
const stageTrigger = (stage: StageId) => `A ticket moves to ${stage === 'lost' ? 'Lost' : STAGE[stage].label}`

function fire(trigger: string, l: Lead) {
  t.campaigns.filter(c => c.kind === 'auto' && c.active && c.trigger === trigger).forEach(c => {
    const body = fill(c.body, l, c.tags)
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
  if (channel !== 'manual') fire(stageTrigger('new'), l)
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
  fire(stageTrigger(stage), l)
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
  if (!fromStage) { l.stage = 'contract'; log(l, { type: 'stage', title: 'Moved to Contract Sent', text: 'Next step booked: waiting for signature.' }); rebookNextStep(l); fire(stageTrigger('contract'), l) }
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
  fire(stageTrigger('signed'), l)
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

/** Turns a draft survey on: it is sent to its audience now. */
export function launchCampaign(c: Campaign) {
  c.draft = false; c.active = true
  if (c.kind === 'auto') toast(`${c.name} is on`, `Sends when ${(c.trigger ?? '').charAt(0).toLowerCase() + (c.trigger ?? '').slice(1)}`)
  else { toast(`${c.name} is on`, 'Sending to the audience now'); sendBroadcast(c) }
}

export function createCampaign(d: NewCampaignInput): Campaign {
  const c: Campaign = { id: uid('c'), kind: d.kind, metric: d.kind === 'survey' ? d.metric ?? 'nps' : undefined, name: d.name, channel: d.channel, steps: 1, sent: 0, subject: /Email/.test(d.channel) ? d.subject : '', body: d.body, recipients: [], tags: d.tags?.length ? d.tags : undefined }
  if (d.draft) {
    c.draft = true; c.active = false; c.trigger = d.trigger; c.audience = d.audience
    if (d.kind === 'auto') t.campaigns.push(c); else t.campaigns.unshift(c)
    toast('Draft saved', c.name)
  } else if (d.kind === 'auto') {
    c.trigger = d.trigger; c.active = true
    t.campaigns.push(c)
    toast(`${c.name} is on`, `Sends when ${d.trigger!.charAt(0).toLowerCase() + d.trigger!.slice(1)}`)
  } else {
    c.audience = d.audience; c.active = true
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
        r.replied = Math.random() < (c.kind === 'survey' ? 0.7 : 0.25)
        if (c.kind === 'survey' && r.replied) { const pool = c.metric === 'csat' ? [5, 5, 5, 4, 4, 4, 3, 2] : [10, 10, 9, 9, 9, 8, 8, 7, 6, 5, 3]; r.score = pool[Math.floor(Math.random() * pool.length)] }
        const body = fill(c.body, l, c.tags) + (ch === 'Text' && !/\bSTOP\b/i.test(c.body) ? ' Reply STOP to opt out.' : '')
        log(l, { type: ch === 'Text' ? 'text' : 'email', cls: 'auto', title: `${c.name} ${ch === 'Text' ? 'text' : 'email'} sent`, text: `From ${ch === 'Text' ? t.firm.number : 'intake@' + t.firm.domain}, ${c.kind === 'survey' ? (c.metric === 'csat' ? 'CSAT' : 'NPS') + ' survey' : 'one-off campaign'}.`, quote: body.length > 140 ? body.slice(0, 140) + '…' : body })
        if (r.replied) log(l, { type: ch === 'Text' ? 'text' : 'email', title: `Reply from ${first(l.name)}`, text: r.score !== undefined ? `Scored ${r.score}${c.metric === 'csat' ? ' out of 5' : ' out of 10'} in ${c.name}.` : `Replied to ${c.name}.`, quote: r.score !== undefined ? String(r.score) : REPLIES[i % REPLIES.length] })
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

/* ---------- intelligence: chat and bots ---------- */
// The assistant is a stand-in: fixed rules read the portal's data and propose changes. A real backend calls a model
// with the bot's instructions, its read tools, the changes it may make and its outside tools. The shapes here
// (steps used, a proposed action the person approves) are what that backend would return.
import { BOT_ACTIONS, EXTERNAL_TOOLS } from './types'

const TOOL_OF: [RegExp, BotTool][] = [
  [/overdue|task|due|follow.?up|deadline|today|attention/i, 'tasks'],
  [/sign|contract|document|engagement|letter/i, 'documents'],
  [/campaign|survey|nps|csat/i, 'campaigns'],
  [/service|pricing|price|catalog/i, 'services'],
  [/message|text|email|inbox|reply/i, 'messages'],
  [/pipeline|stage|lead|enquir|fee|value|revenue|funnel|contact|client/i, 'leads'],
]
const TOOL_LABEL: Record<BotTool, string> = { leads: 'Leads and contacts', tasks: 'Tasks', documents: 'Documents', campaigns: 'Campaigns', messages: 'Messages', services: 'Services' }
const bold = (s: string | number) => `**${s}**`
const STAGE_WORDS: [RegExp, StageId][] = [
  [/lost/i, 'lost'], [/services? provided|delivered|complete/i, 'delivered'], [/payment/i, 'payment'], [/signed/i, 'signed'],
  [/contract/i, 'contract'], [/consult/i, 'consult'], [/contacted/i, 'contacted'], [/new/i, 'new'],
]
const leadIn = (s: string) => t.leads.find(l => s.toLowerCase().includes(l.name.toLowerCase())) ?? t.leads.find(l => s.toLowerCase().includes(first(l.name).toLowerCase()))
const label = (st: StageId) => (st === 'lost' ? 'Lost' : STAGE[st].label)

interface Reply { text: string; steps?: string[]; action?: ChatAction }

/** Reads a request to change something in the portal. Returns the proposed change, a refusal, or nothing when it is not one. */
function proposal(text: string, bot: Bot | undefined): Reply | null {
  const who = bot ? bold(bot.name) : 'The assistant'
  const need = (kind: BotAction, build: () => Reply): Reply => (bot && !bot.actions.includes(kind)
    ? { text: `${who} isn't set up to ${BOT_ACTIONS[kind].label.toLowerCase()}. Switch it on under Agents, in "Can do in the portal".` } : build())
  const missing = (name: string): Reply => ({ text: `I couldn't find a lead called ${bold(name)}. Check the name and try again.` })
  let m: RegExpMatchArray | null

  if ((m = text.match(/(?:create|add|log|new)\s+(?:an?\s+)?(?:new\s+)?(?:lead|enquiry|ticket)\s+(?:for|called|named)?\s*(.+)/i))) {
    const name = m[1].replace(/[.!?]+$/, '').trim()
    return need('create_lead', () => ({ text: `I can add an enquiry for ${bold(name)}. Approve it and I'll create the ticket.`,
      action: { kind: 'create_lead', summary: `Create an enquiry for ${name}`, params: { name }, status: 'proposed' } }))
  }
  if ((m = text.match(/move\s+(.+?)\s+to\s+(.+?)[.!?]*$/i))) {
    const l = leadIn(m[1]); const st = STAGE_WORDS.find(([re]) => re.test(m![2]))?.[1]
    if (!l) return missing(m[1])
    if (!st) return { text: `I don't know the stage "${m[2]}". The stages are ${config.stages.map(x => x.label).join(', ')} and Lost.` }
    return need('move_stage', () => ({ text: `I can move ${bold(l.name)} from ${label(l.stage)} to ${bold(label(st))}.`, steps: [`Looked up ${l.name}`],
      action: { kind: 'move_stage', summary: `Move ${l.name} to ${label(st)}`, params: { leadId: l.id, stage: st }, status: 'proposed' } }))
  }
  if ((m = text.match(/(?:book|schedule|set up|add)\s+(?:an?\s+)?(call|meeting|task|reminder|follow.?up)\s+(?:with|for)\s+(.+?)(?:\s+(tomorrow|today|next week))?[.!?]*$/i))) {
    const l = leadIn(m[2])
    if (!l) return missing(m[2])
    const when = (m[3] ?? 'tomorrow').toLowerCase(), kind = m[1].toLowerCase().replace(/\s+/g, '_').replace('followup', 'follow_up').replace('reminder', 'follow_up')
    return need('book_task', () => ({ text: `I can book a ${m![1].toLowerCase()} with ${bold(l.name)} for ${when}.`, steps: [`Looked up ${l.name}`],
      action: { kind: 'book_task', summary: `Book a ${m![1].toLowerCase()} with ${l.name}, ${when}`, params: { leadId: l.id, type: kind, when }, status: 'proposed' } }))
  }
  if ((m = text.match(/(?:text|sms)\s+(.+?)\s+(?:saying|that|:)\s*(.+)/i))) {
    const l = leadIn(m[1])
    if (!l) return missing(m[1])
    const body = m[2].trim()
    return need('send_text', () => ({ text: `Here is the text I would send to ${bold(l.name)}:\n“${body}”`, steps: [`Looked up ${l.name}`],
      action: { kind: 'send_text', summary: `Text ${l.name}`, params: { leadId: l.id, body }, status: 'proposed' } }))
  }
  if ((m = text.match(/(?:set|add)\s+services?\s+(?:for|on)\s+(.+?)\s+(?:to|as)\s+(.+?)[.!?]*$/i))) {
    const l = leadIn(m[1])
    if (!l) return missing(m[1])
    const picked = t.services.filter(sv => sv.active && m![2].toLowerCase().includes(sv.name.toLowerCase()))
    if (!picked.length) return { text: `I couldn't match a service in "${m[2]}". Try the name as it appears in the Services page.` }
    return need('set_services', () => ({ text: `I can set ${bold(l.name)}'s services to ${picked.map(x => bold(x.name)).join(', ')}.`, steps: [`Looked up ${l.name}`, 'Read the service catalog'],
      action: { kind: 'set_services', summary: `Set services for ${l.name}: ${picked.map(x => x.name).join(', ')}`, params: { leadId: l.id, serviceIds: picked.map(x => x.id).join(',') }, status: 'proposed' } }))
  }
  return null
}

function answer(text: string, bot: Bot | undefined): Reply {
  const act = proposal(text, bot)
  if (act) return act
  const name = bot?.name ?? 'UNIR Assistant'
  // outside the portal: only bots with those tools
  const url = text.match(/https?:\/\/\S+/)?.[0]
  if (url) {
    return bot?.external.includes('pages')
      ? { text: `I opened ${url} and read it. (Sample mode: no page was fetched. A connected backend returns a summary and its sources here.)`, steps: [EXTERNAL_TOOLS.pages.label] }
      : { text: `I can only work inside the portal. To read a web page, create an agent with "${EXTERNAL_TOOLS.pages.label}" switched on, then chat with it.` }
  }
  if (/\b(search|look up|google|latest|news|online|on the web)\b/i.test(text)) {
    return bot?.external.includes('web')
      ? { text: `I searched the web for “${text.replace(/[?.!]+$/, '')}”. (Sample mode: no real search ran. A connected backend returns the findings with their sources here.)`, steps: [EXTERNAL_TOOLS.web.label] }
      : { text: `I can only work inside the portal. To look something up online, create an agent with "${EXTERNAL_TOOLS.web.label}" switched on, then chat with it.` }
  }
  const tool = TOOL_OF.find(([re]) => re.test(text))?.[1]
  if (tool && bot && !bot.tools.includes(tool)) {
    return { text: `I can't look at ${TOOL_LABEL[tool].toLowerCase()} yet, because that tool is switched off for ${bold(name)}. Turn it on under Agents, then ask me again.` }
  }
  const open = t.leads.filter(l => !['delivered', 'lost'].includes(l.stage))
  const used = tool ? [TOOL_LABEL[tool]] : undefined
  switch (tool) {
    case 'tasks': {
      const eod = new Date(); eod.setHours(23, 59, 59, 999)
      const late = t.tasks.filter(x => !x.done && x.dueAt < Date.now()), today = t.tasks.filter(x => !x.done && x.dueAt <= +eod)
      const lines = today.slice(0, 4).map(x => `• ${x.title}${x.leadId ? ` (${t.leads.find(l => l.id === x.leadId)?.name ?? ''})` : ''}`)
      return { steps: used, text: `You have ${bold(today.length)} ${today.length === 1 ? 'task' : 'tasks'} due today, and ${bold(late.length)} overdue.${lines.length ? '\n' + lines.join('\n') : ''}` }
    }
    case 'documents': {
      const waiting = t.leads.filter(l => l.doc && l.doc.status !== 'signed')
      const signed = t.leads.filter(l => l.doc?.status === 'signed').length
      return { steps: used, text: `${bold(waiting.length)} ${waiting.length === 1 ? 'contract is' : 'contracts are'} waiting for a signature and ${bold(signed)} ${signed === 1 ? 'is' : 'are'} signed.${waiting.length ? '\n' + waiting.map(l => `• ${l.name}, ${l.doc!.items?.[0]?.name ?? 'Engagement Letter'}`).join('\n') : ''}` }
    }
    case 'campaigns': {
      const on = t.campaigns.filter(c => c.active).length
      const sv = t.campaigns.filter(c => c.kind === 'survey')
      return { steps: used, text: `${bold(on)} of ${bold(t.campaigns.length)} campaigns are on, including ${bold(sv.length)} ${sv.length === 1 ? 'survey' : 'surveys'}. ${t.campaigns.reduce((a, c) => a + c.sent, 0)} messages have been delivered so far.` }
    }
    case 'services': {
      const act = t.services.filter(s => s.active)
      return { steps: used, text: `The firm provides ${bold(act.length)} active services across ${new Set(act.map(s => s.practice)).size} practice areas. Open the Services page for default pricing.` }
    }
    case 'messages':
      return { steps: used, text: `Texts and emails are sent from the firm's own domain and number${canText() && canEmail() ? '.' : ', but some are held until sending is set up in Settings.'} To text a lead, say: text Rachel Greene saying …` }
    case 'leads': {
      const by = config.stages.map(s => ({ s, n: t.leads.filter(l => l.stage === s.id).length })).filter(x => x.n)
      const fee = open.filter(l => STAGE[l.stage].i >= 3).reduce((a, l) => a + l.value, 0)
      return { steps: used, text: `There are ${bold(open.length)} open leads.\n${by.map(x => `• ${x.s.label}: ${x.n}`).join('\n')}\nOpen pipeline value once services are known: ${bold('$' + fee.toLocaleString('en-US'))}.` }
    }
    default:
      return { text: `I'm ${bold(name)}. Ask me about the pipeline, tasks, contracts or campaigns, or tell me to do something: “create a lead for Priya Shah”, “move Tom Alvarez to Consultation”, “book a call with Rachel Greene tomorrow”, “text Rachel Greene saying …”.` }
  }
}

export function createConversation(botId: string | null): ChatConversation {
  const now = Date.now()
  const c: ChatConversation = { id: uid('chat'), title: 'New chat', botId, createdAt: now, updatedAt: now, messages: [] }
  t.conversations.unshift(c)
  return c
}

export function sendChat(id: string, text: string) {
  const c = t.conversations.find(x => x.id === id)
  const msg = text.trim()
  if (!c || !msg || c.pending) return
  c.messages.push({ id: uid('m'), role: 'user', text: msg, at: Date.now() })
  if (c.title === 'New chat') c.title = msg.length > 44 ? msg.slice(0, 44) + '…' : msg
  c.updatedAt = Date.now(); c.pending = true
  const bot = c.botId ? t.bots.find(a => a.id === c.botId) : undefined
  setTimeout(() => {
    const cur = t.conversations.find(x => x.id === id)
    if (!cur) return
    const r = answer(msg, bot)
    cur.messages.push({ id: uid('m'), role: 'assistant', text: r.text, at: Date.now(), steps: r.steps, action: r.action })
    cur.pending = false; cur.updatedAt = Date.now(); cur.unread = true
    if (bot) bot.runs++
    store.commit()
  }, 900)
}

/** Makes the change the assistant proposed, in the portal, as the person who approved it. */
function execute(a: ChatAction): string {
  const lead = a.params.leadId ? findLead(a.params.leadId) : null
  switch (a.kind) {
    case 'create_lead': { const l = createLead('manual', { name: a.params.name, practice: config.practiceAreas[0], matter: 'New enquiry' }); return `Created the ticket for ${l.name}.` }
    case 'move_stage': setStage(lead!, a.params.stage as StageId); return `${lead!.name} is now ${label(a.params.stage as StageId)}.`
    case 'book_task': {
      const d = new Date(); d.setHours(10, 0, 0, 0)
      d.setDate(d.getDate() + (a.params.when === 'today' ? 0 : a.params.when === 'next week' ? 7 : 1))
      const item = { id: uid('g'), type: a.params.type as Task['type'], title: `${a.params.type === 'follow_up' ? 'Follow up with' : a.params.type === 'task' ? 'Task for' : a.params.type === 'meeting' ? 'Meeting with' : 'Call'} ${lead!.name}`, dueAt: +d, done: false, assignedTo: lead!.owner, leadId: lead!.id }
      t.tasks.unshift(item)
      log(lead!, { type: 'reminder', cls: '', title: `Scheduled: ${item.title}`, text: `Booked from Chat, on ${lead!.owner}’s task list.` })
      return `Booked: ${item.title}.`
    }
    case 'send_text': sendText(lead!, a.params.body); return `Text sent to ${first(lead!.name)}.`
    case 'set_services': setServices(lead!, a.params.serviceIds.split(',')); return `Services updated for ${lead!.name}.`
  }
}
export function approveChat(convId: string, messageId: string) {
  const a = t.conversations.find(c => c.id === convId)?.messages.find(m => m.id === messageId)?.action
  if (!a || a.status !== 'proposed') return
  try { a.result = execute(a); a.status = 'done' } catch (e) { a.result = e instanceof Error ? e.message : 'Something went wrong.'; a.status = 'failed' }
}
export function declineChat(convId: string, messageId: string) {
  const a = t.conversations.find(c => c.id === convId)?.messages.find(m => m.id === messageId)?.action
  if (a && a.status === 'proposed') { a.status = 'cancelled'; a.result = 'Nothing was changed.' }
}
