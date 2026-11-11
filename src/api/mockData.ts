// Mock data for the UNIR portal. The mock endpoints in ./index.ts read from this file until the real backend is ready.
// Everything is generated relative to "now" so the sample firm always looks current.
import type { Activity, Bot, Campaign, ChatConversation, DocField, Firm, FirmEvent, Integration, Lead, PortalConfig, PortalDocument, SentItem, Service, SourceId, StageId, Task, TeamMember } from './types'

export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** Static configuration: pipeline stages, sources, owners and form options. */
export const config: PortalConfig = {
  stages: [
    { id: 'new', label: 'New Enquiry', next: 'Call within the hour' },
    { id: 'contacted', label: 'Contacted', next: 'Book a consultation' },
    { id: 'consult', label: 'Consultation', next: 'Attorney review, then send the contract' },
    { id: 'contract', label: 'Contract Sent', next: 'Waiting for signature' },
    { id: 'signed', label: 'Signed', next: 'Request the retainer payment' },
    { id: 'payment', label: 'Payment Pending', next: 'Collect the retainer payment' },
    { id: 'delivered', label: 'Services Provided', next: 'Closed' },
  ],
  sources: { web: 'Website Form', email: 'Email', text: 'Text Message', manual: 'Phone Call', referral: 'Referral', ads: 'Google Ads' },
  owners: ['Sarah Mitchell', 'David Cohen', 'Priya Nair', 'James Okafor'],
  lostReasons: ['Went with another firm', 'Could not afford the fee', 'Outside our practice areas', 'No response after follow-up', 'Conflict of interest'],
  practiceAreas: ['Family law', 'Personal injury', 'Immigration', 'Estate planning', 'Employment', 'Criminal defense', 'Business law', 'Real estate'],
  // An automatic campaign runs when a ticket reaches one of the pipeline stages
  triggers: ['New Enquiry', 'Contacted', 'Consultation', 'Contract Sent', 'Signed', 'Payment Pending', 'Services Provided', 'Lost'].map(s => `A ticket moves to ${s}`),
  audiences: {
    open: { label: 'Open leads', hint: 'Everyone still in the pipeline' },
    consult: { label: 'Booked or due a consultation', hint: 'Contacted and Consultation stages' },
    clients: { label: 'Clients and past clients', hint: 'Signed and Services Provided' },
    lost: { label: 'Lost leads', hint: 'A win-back message' },
    all: { label: 'Everyone', hint: 'Every contact in the firm' },
  },
}

/** Sample enquiries for the "New Enquiry" buttons. */
export const enquiryPool = [
  { name: 'Carmen Ortiz', matter: 'Custody modification', practice: 'Family law', value: 5500 },
  { name: 'Kevin Huang', matter: 'Car accident injury claim', practice: 'Personal injury', value: 24000 },
  { name: 'Amara Okoye', matter: 'H-1B transfer', practice: 'Immigration', value: 4800 },
  { name: 'Brian Walsh', matter: 'Trust and will package', practice: 'Estate planning', value: 3200 },
  { name: 'Nadia Rahman', matter: 'Unpaid overtime claim', practice: 'Employment', value: 12000 },
  { name: 'Luis Moreno', matter: 'DUI defense', practice: 'Criminal defense', value: 7500 },
  { name: 'Grace Kim', matter: 'LLC formation', practice: 'Business law', value: 2500 },
  { name: 'Owen Price', matter: 'Uncontested divorce', practice: 'Family law', value: 3800 },
]

export const team: TeamMember[] = [
  { name: 'Sarah Mitchell', role: 'Intake Manager', permission: 'Admin' },
  { name: 'David Cohen', role: 'Attorney', permission: 'Member' },
  { name: 'Priya Nair', role: 'Paralegal', permission: 'Member' },
  { name: 'James Okafor', role: 'Intake Specialist', permission: 'Member' },
]

export const firm = (): Firm => ({
  name: 'Example Family Law LLP', domain: 'examplefamilylaw.com', number: '(555) 010-0142',
  domainStatus: 'unverified', textStatus: 'unregistered',
})

export const integrations = (): Integration[] => [
  { id: 'web', name: 'Website Form', icon: 'globe', on: true, desc: 'Enquiries from your website arrive as leads and get the instant reply.' },
  { id: 'ads', name: 'Google Ads', icon: 'bolt', on: true, desc: 'Lead form and call ads come in tagged with the campaign they came from.' },
  { id: 'gcal', name: 'Google Calendar', icon: 'calendar', on: false, desc: 'Consultations and follow-ups appear on each attorney’s calendar.' },
  { id: 'outlook', name: 'Microsoft Outlook', icon: 'mail', on: false, desc: 'Sync calendars and keep email threads on the lead’s timeline.' },
  { id: 'calls', name: 'Call Tracking', icon: 'phone', on: false, desc: 'Tracked calls become leads, with the number and source attached.' },
]

/** n working days from today (skips weekends), at hh:mm */
export function businessDay(n: number, hh: number, mm: number): number {
  const x = new Date()
  x.setHours(hh, mm, 0, 0)
  let k = 0
  while (k < n || x.getDay() % 6 === 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++ }
  return +x
}

export const firmEvents = (): FirmEvent[] => [
  { id: 'ev1', t: businessDay(1, 9, 0), dur: 30, title: 'Intake team huddle', who: 'Whole intake team' },
  { id: 'ev2', t: businessDay(2, 13, 0), dur: 60, title: 'Partners lunch', who: 'David Cohen' },
  { id: 'ev3', t: businessDay(3, 10, 0), dur: 60, title: 'Intake team weekly review', who: 'Whole intake team' },
  { id: 'ev4', t: businessDay(4, 14, 30), dur: 90, title: 'Monthly marketing review', who: 'Sarah Mitchell and David Cohen' },
  { id: 'ev5', t: businessDay(5, 9, 0), dur: 30, title: 'Intake team huddle', who: 'Whole intake team' },
]

/** The services the firm provides, with default pricing. */
export function services(): Service[] {
  const now = Date.now()
  const sv = (id: string, name: string, practice: string, description: string, pricingModel: Service['pricingModel'], price: number, retainer: number, active = true): Service =>
    ({ id, name, practice, description, pricingModel, price, retainer, active, createdAt: now - 120 * DAY, updatedAt: now - (Number(id.slice(2)) * 4 + 3) * DAY })
  return [
    sv('sv1', 'Uncontested Divorce', 'Family law', 'Filing, settlement agreement and final decree for agreed divorces.', 'flat', 3500, 1500),
    sv('sv2', 'Contested Divorce & Custody', 'Family law', 'Representation through negotiation, mediation and trial.', 'hourly', 350, 5000),
    sv('sv3', 'Personal Injury Claim', 'Personal injury', 'Full representation on a no-win-no-fee basis.', 'contingency', 33, 0),
    sv('sv4', 'Family Visa Petition (I-130)', 'Immigration', 'Preparation and filing of family-based petitions.', 'flat', 2800, 1500),
    sv('sv5', 'Work Visa / Green Card', 'Immigration', 'H-1B, PERM and adjustment of status.', 'flat', 4200, 2000),
    sv('sv6', 'Will & Living Trust Package', 'Estate planning', 'Will, revocable trust, power of attorney and healthcare directive.', 'flat', 3500, 1750),
    sv('sv7', 'DUI / Criminal Defense', 'Criminal defense', 'Defense through arraignment, hearings and trial.', 'flat', 9000, 4500),
    sv('sv8', 'LLC Formation', 'Business law', 'Entity formation, operating agreement and EIN setup.', 'flat', 1200, 1200),
    sv('sv9', 'Outside General Counsel', 'Business law', 'Ongoing contract review and business advisory.', 'monthly', 3000, 3000),
    sv('sv10', 'Wrongful Termination', 'Employment', 'Claims and negotiation for unlawful dismissal.', 'hourly', 300, 3000),
    sv('sv11', 'Commercial Lease Review', 'Real estate', 'Lease negotiation and dispute resolution.', 'flat', 5200, 2600),
    sv('sv12', 'Probate Administration', 'Estate planning', 'Court-supervised estate administration.', 'hourly', 275, 2500, false),
  ]
}
/** A sensible starting fee for a service (contingency cannot be estimated up front, so it starts from the retainer). */
export const defaultFee = (s: Service): number => ({ flat: s.price, hourly: s.retainer, monthly: s.price * 12, contingency: s.retainer }[s.pricingModel])

/** The document library: uploaded files plus the inputs each one needs (filled from the ticket when sent). */
export function documents(): PortalDocument[] {
  const now = Date.now()
  const f = (id: string, label: string, source: DocField['source'], kind: DocField['kind'] = 'text', required = true): DocField => ({ id, label, source, kind, required })
  const file = (name: string, kb: number, ago: number) => ({ name, size: kb * 1024, type: 'application/pdf', uploadedAt: now - ago * DAY })
  const base = { active: true, updatedBy: 'Sarah Mitchell' }
  return [
    { ...base, id: 'd1', name: 'Engagement Letter', category: 'Engagement', description: 'Scope of representation, fee and terms, with a signature field. Sent to every new client.',
      file: file('Engagement Letter v3.pdf', 184, 40), createdAt: now - 90 * DAY, updatedAt: now - 40 * DAY,
      fields: [f('client', 'Client name', 'name'), f('email', 'Client email', 'email'), f('matter', 'Matter', 'matter'), f('practice', 'Practice area', 'practice'),
        f('services', 'Services', 'services'), f('fee', 'Estimated fee', 'fee', 'money'), f('attorney', 'Responsible attorney', 'owner'), f('retainer', 'Retainer amount', 'manual', 'money'), f('date', 'Date', 'today', 'date')] },
    { ...base, id: 'd2', name: 'Fee Schedule', category: 'Fees', description: 'Hourly rates and billing terms. Attached to every engagement letter.',
      file: file('Fee Schedule 2026.pdf', 92, 25), createdAt: now - 90 * DAY, updatedAt: now - 25 * DAY,
      fields: [f('client', 'Client name', 'name'), f('matter', 'Matter', 'matter'), f('fee', 'Estimated fee', 'fee', 'money'), f('rate', 'Hourly rate', 'manual', 'money'), f('billing', 'Billing frequency', 'manual')] },
    { ...base, id: 'd3', name: 'Intake Questionnaire', category: 'Intake', description: 'Background questions for the client to answer before the consultation.',
      file: file('Intake Questionnaire.pdf', 121, 60), createdAt: now - 120 * DAY, updatedAt: now - 60 * DAY,
      fields: [f('client', 'Client name', 'name'), f('phone', 'Phone', 'phone'), f('email', 'Email', 'email'), f('practice', 'Practice area', 'practice')] },
    { ...base, id: 'd4', name: 'Conflict Check Form', category: 'Compliance', description: 'Completed by the team before taking on a matter.',
      file: file('Conflict Check Form.pdf', 68, 75), createdAt: now - 120 * DAY, updatedAt: now - 75 * DAY,
      fields: [f('client', 'Client name', 'name'), f('matter', 'Matter', 'matter'), f('opposing', 'Opposing party', 'manual', 'text', false), f('date', 'Date', 'today', 'date')] },
    { ...base, id: 'd5', name: 'Privacy Notice', category: 'Compliance', description: 'How the firm handles client information. Acknowledged by the client.',
      file: file('Privacy Notice.pdf', 54, 30), createdAt: now - 60 * DAY, updatedAt: now - 30 * DAY,
      fields: [f('client', 'Client name', 'name'), f('firm', 'Firm name', 'firm'), f('date', 'Date', 'today', 'date')] },
    { ...base, id: 'd6', name: 'Retainer Agreement (draft)', category: 'Engagement', description: 'Upload the final file to make this available when sending documents.',
      file: null, active: false, createdAt: now - 6 * DAY, updatedAt: now - 2 * DAY, updatedBy: 'David Cohen',
      fields: [f('client', 'Client name', 'name'), f('retainer', 'Retainer amount', 'manual', 'money')] },
  ]
}

const money0 = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
/** Values for a document's inputs taken from a ticket (mirrors what the Send documents dialog pre-fills). */
function packetItem(doc: PortalDocument, lead: { name: string; email: string; phone: string; matter: string; practice: string; value: number; owner: string; source: SourceId; services?: string }, sentAt: number): SentItem {
  const v: Record<string, string> = {}
  doc.fields.forEach(fl => {
    v[fl.id] = ({ name: lead.name, email: lead.email, phone: lead.phone, matter: lead.matter, practice: lead.practice, fee: money0(lead.value), owner: lead.owner,
      source: config.sources[lead.source], services: lead.services ?? '', today: new Date(sentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), firm: 'Example Family Law LLP', manual: '' } as Record<string, string>)[fl.source]
  })
  return { templateId: doc.id, name: doc.name, values: v }
}

interface LeadSeed {
  id: string; name: string; matter: string; practice: string; source: SourceId; value: number
  stage: StageId; age: number; owner: string; phone: string; lostReason?: string
}
const leadSeeds: LeadSeed[] = [
  { id: 'l1', name: 'Rachel Greene', matter: 'Contested divorce and custody', practice: 'Family law', source: 'ads', value: 6500, stage: 'new', age: 0.1, owner: 'Sarah Mitchell', phone: '(212) 555-0141' },
  { id: 'l2', name: 'Marcus Webb', matter: 'Slip and fall injury', practice: 'Personal injury', source: 'referral', value: 28000, stage: 'new', age: 0.4, owner: 'David Cohen', phone: '(646) 555-0199' },
  { id: 'l3', name: 'Tom Alvarez', matter: 'LLC formation', practice: 'Business law', source: 'referral', value: 2500, stage: 'contacted', age: 4, owner: 'James Okafor', phone: '(718) 555-0177' },
  { id: 'l4', name: 'Elena Petrova', matter: 'Work visa to green card', practice: 'Immigration', source: 'web', value: 4200, stage: 'contacted', age: 3, owner: 'Priya Nair', phone: '(917) 555-0102' },
  { id: 'l5', name: 'Hannah Lee', matter: 'Will and living trust', practice: 'Estate planning', source: 'web', value: 3500, stage: 'consult', age: 6, owner: 'Sarah Mitchell', phone: '(212) 555-0166' },
  { id: 'l6', name: 'Omar Haddad', matter: 'DUI defense', practice: 'Criminal defense', source: 'ads', value: 9000, stage: 'consult', age: 5, owner: 'David Cohen', phone: '(347) 555-0123' },
  { id: 'l7', name: 'Linda Park', matter: 'Wrongful termination', practice: 'Employment', source: 'web', value: 15000, stage: 'contract', age: 9, owner: 'Priya Nair', phone: '(929) 555-0188' },
  { id: 'l8', name: 'Sofia Reyes', matter: 'Divorce settlement', practice: 'Family law', source: 'referral', value: 8000, stage: 'signed', age: 14, owner: 'Priya Nair', phone: '(212) 555-0119' },
  { id: 'l9', name: 'Daniel Brooks', matter: 'Premises liability claim', practice: 'Personal injury', source: 'referral', value: 30000, stage: 'delivered', age: 40, owner: 'David Cohen', phone: '(212) 555-0132' },
  { id: 'l10', name: 'Gary Nolan', matter: 'Commercial lease review', practice: 'Business law', source: 'ads', value: 2000, stage: 'lost', age: 12, owner: 'James Okafor', phone: '(631) 555-0150', lostReason: 'Went with another firm' },
]

/** The services chosen on the sample tickets that are past the consultation (earlier tickets have none yet). */
const SERVICES_OF: Record<string, string[]> = { l7: ['sv10'], l8: ['sv1'], l9: ['sv3'] }
const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, '.')
const stageIndex = (s: StageId) => (s === 'lost' ? -1 : config.stages.findIndex(x => x.id === s))

export function leads(): Lead[] {
  const now = Date.now()
  return leadSeeds.map(s => {
    const created = now - s.age * DAY
    const acts: Activity[] = [{ t: created, type: 'enquiry', cls: '', title: 'Enquiry received', text: `Came in by ${config.sources[s.source].toLowerCase()}.` }]
    const i = s.stage === 'lost' ? 1 : stageIndex(s.stage)
    let doc: Lead['doc'] = null
    const lib = documents()
    const svcList = services()
    const svcNames = (SERVICES_OF[s.id] ?? []).map(id => svcList.find(x => x.id === id)?.name ?? '').filter(Boolean).join(', ')
    const packet = (sentAt: number): SentItem[] => [packetItem(lib[0], { ...s, email: `${slug(s.name)}@example.com`, services: svcNames }, sentAt), ...(s.id === 'l7' ? [packetItem(lib[1], { ...s, email: `${slug(s.name)}@example.com`, services: svcNames }, sentAt)] : [])]
    if (i >= 1) acts.push({ t: created + 2 * HOUR, type: 'call', cls: '', title: `Call logged by ${s.owner}`, text: 'Discussed the matter and next steps.' })
    if (i >= 2) acts.push({ t: created + DAY, type: 'meeting', cls: '', title: 'Consultation held', text: 'Attorney review completed.' })
    if (i >= 3) { doc = { status: 'sent', sent: created + 2 * DAY, items: packet(created + 2 * DAY) }; acts.push({ t: doc.sent, type: 'doc', cls: 'auto', title: s.id === 'l7' ? '2 documents sent for signature' : 'Engagement letter sent', text: 'By email and text link.' }) }
    if (i >= 4 && doc) { doc = { ...doc, status: 'signed', signed: created + 3 * DAY, by: s.name }; acts.push({ t: doc.signed!, type: 'signed', cls: 'good', title: `Signed by ${s.name}`, text: 'Stage moved to Signed automatically.' }) }
    if (i >= 5) acts.push({ t: created + 4 * DAY, type: 'stage', cls: '', title: 'Payment requested', text: 'Retainer payment requested.' })
    if (i >= 6) acts.push({ t: created + 30 * DAY, type: 'stage', cls: 'good', title: 'Services provided', text: 'Matter closed.' })
    if (s.stage === 'lost') acts.push({ t: created + 5 * DAY, type: 'lost', cls: 'bad', title: 'Marked as lost', text: `Reason: ${s.lostReason}.` })
    return {
      id: s.id, name: s.name, email: `${slug(s.name)}@example.com`, phone: s.phone, matter: s.matter, practice: s.practice,
      source: s.source, value: s.value, stage: s.stage, owner: s.owner, created, activities: acts, doc,
      lostReason: s.lostReason ?? null, optedOut: s.name === 'Gary Nolan' ? true : undefined, serviceIds: SERVICES_OF[s.id],
    }
  })
}

/** Tasks: each open lead has its booked next step, plus the firm's own tasks and deadlines. */
export function tasks(): Task[] {
  const now = Date.now()
  const at = (d: number, h: number, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return +x }
  return [
    { id: 'g1', type: 'call', title: 'Call within the hour', dueAt: now + HOUR, done: false, assignedTo: 'Sarah Mitchell', leadId: 'l1', auto: true },
    { id: 'g2', type: 'call', title: 'Call within the hour', dueAt: now + 30 * 60_000, done: false, assignedTo: 'David Cohen', leadId: 'l2', auto: true },
    { id: 'g3', type: 'meeting', title: 'Book a consultation', dueAt: businessDay(1, 10, 0), done: false, assignedTo: 'James Okafor', leadId: 'l3', auto: true },
    { id: 'g4', type: 'follow_up', title: 'Book a consultation', dueAt: businessDay(1, 14, 30), done: false, assignedTo: 'Priya Nair', leadId: 'l4', auto: true },
    { id: 'g5', type: 'task', title: 'Attorney review, then send the contract', dueAt: businessDay(2, 11, 0), done: false, assignedTo: 'Sarah Mitchell', leadId: 'l5', auto: true },
    { id: 'g6', type: 'task', title: 'Attorney review, then send the contract', dueAt: businessDay(3, 15, 30), done: false, assignedTo: 'David Cohen', leadId: 'l6', auto: true },
    { id: 'g7', type: 'follow_up', title: 'Waiting for signature', dueAt: businessDay(2, 16, 0), done: false, assignedTo: 'Priya Nair', leadId: 'l7', auto: true },
    { id: 'g8', type: 'task', title: 'Send HIPAA authorization', dueAt: at(0, 17), done: false, assignedTo: 'David Cohen', leadId: 'l9' },
    { id: 'g9', type: 'deadline', title: 'Filing deadline for the Brooks claim', dueAt: at(14, 9), done: false, assignedTo: 'David Cohen', leadId: 'l9' },
    { id: 'g10', type: 'follow_up', title: 'Follow-up call', dueAt: at(-1, 13), done: false, assignedTo: 'Priya Nair', leadId: 'l4' },
    { id: 'g11', type: 'meeting', title: 'Case kickoff', dueAt: at(-7, 11), done: true, completedAt: at(-7, 12), assignedTo: 'Priya Nair', leadId: 'l8' },
    { id: 'g12', type: 'task', title: 'Send LLC formation proposal', dueAt: at(3, 10), done: false, assignedTo: 'James Okafor', leadId: 'l3' },
  ]
}

/** The question a survey asks, with the scale it expects back. */
export const surveyBody = (metric: 'nps' | 'csat') => metric === 'nps'
  ? 'Hi {first}, thank you for choosing {firm}. On a scale of 0 to 10, how likely are you to recommend us to a friend or colleague? Reply with a number.'
  : 'Hi {first}, how satisfied were you with the help you got from {firm}? Reply with a number from 1 (very unhappy) to 5 (very happy).'

export function campaigns(leadList: Lead[]): Campaign[] {
  const past = leadList.filter(l => l.stage === 'signed' || l.stage === 'payment' || l.stage === 'delivered')
  const auto = (c: Omit<Campaign, 'kind' | 'recipients' | 'sent'>): Campaign => ({ ...c, kind: 'auto', recipients: [], sent: 0 })
  const survey = (id: string, name: string, metric: 'nps' | 'csat', scores: number[], ago: number): Campaign => ({
    id, kind: 'survey', metric, name, active: metric === 'nps', audience: 'clients', channel: 'Text and Email', steps: 1, sent: past.length, sentAt: Date.now() - ago * DAY,
    subject: metric === 'nps' ? 'How likely are you to recommend us, {first}?' : 'How did we do, {first}?',
    body: surveyBody(metric),
    recipients: past.map((l, i) => ({ id: l.id, name: l.name, channel: 'Email' as const, status: 'delivered' as const, opened: true, replied: i < scores.length, score: scores[i] })),
  })
  return [
    auto({ id: 'c1', name: 'Instant Reply', trigger: 'A ticket moves to New Enquiry', channel: 'Text', steps: 1, active: true, body: 'Hi {first}, thanks for contacting Example Family Law. An attorney will call you today. Reply STOP to opt out.' }),
    auto({ id: 'c2', name: 'New Enquiry Welcome', trigger: 'A ticket moves to New Enquiry', channel: 'Email', steps: 3, active: true, body: 'Hi {first},\n\nThank you for reaching out about your {matter}. Here is what happens next, and what to bring to your consultation.' }),
    auto({ id: 'c3', name: 'Consultation Reminder', trigger: 'A ticket moves to Consultation', channel: 'Text and Email', steps: 2, active: true, body: 'Hi {first}, a reminder of your consultation tomorrow. Reply C to confirm.' }),
    auto({ id: 'c4', name: 'Signature Follow-Up', trigger: 'A ticket moves to Contract Sent', channel: 'Text', steps: 2, active: true, body: 'Hi {first}, your engagement letter is ready to sign: sign.example.com/abc' }),
    auto({ id: 'c5', name: 'Monthly Newsletter', trigger: 'A ticket moves to Services Provided', channel: 'Email', steps: 1, active: false, body: 'News and updates from Example Family Law.' }),
    {
      id: 'c6', kind: 'broadcast', active: true, name: 'Year-End Estate Planning Check-In', audience: 'clients', channel: 'Email', steps: 1, sent: past.length, sentAt: Date.now() - 12 * DAY,
      subject: 'Is your estate plan up to date, {first}?',
      body: 'Hi {first},\n\nThe end of the year is a good time to review your will and beneficiaries. Reply to this email and we will set up a short call.',
      recipients: past.map((l, i) => ({ id: l.id, name: l.name, channel: 'Email' as const, status: 'delivered' as const, opened: true, replied: i === 0 })),
    },
    survey('c7', 'Client NPS Survey', 'nps', [10, 7], 30),
    survey('c8', 'Client Satisfaction (CSAT)', 'csat', [5, 4], 18),
  ]
}

/* ---------- intelligence ---------- */
export const bots = (): Bot[] => {
  const now = Date.now()
  const a = (id: string, name: string, description: string, instructions: string, model: Bot['model'], tools: Bot['tools'], actions: Bot['actions'], external: Bot['external'], active: boolean, runs: number, ago: number): Bot =>
    ({ id, name, description, instructions, model, tools, actions, external, active, runs, createdAt: now - (ago + 20) * DAY, updatedAt: now - ago * DAY, updatedBy: 'Sarah Mitchell' })
  return [
    a('a1', 'Intake Assistant', 'Qualifies new enquiries, drafts the first reply and books the call.',
      'You help the intake team. For every new enquiry, check the practice area and matter, draft a warm first reply in the firm’s voice, and suggest the next step. Never give legal advice. Keep replies under 80 words.',
      'balanced', ['leads', 'tasks', 'messages'], ['create_lead', 'book_task', 'send_text'], [], true, 128, 3),
    a('a2', 'Follow-up Writer', 'Drafts follow-up texts and emails for leads that have gone quiet.',
      'Write short, friendly follow-ups for leads with no activity in the last 3 days. Mention the matter, offer a time to talk, and always include an easy way to opt out.',
      'fast', ['leads', 'messages', 'campaigns'], ['send_text'], [], true, 64, 9),
    a('a3', 'Document Drafter', 'Prepares engagement letters and fills their inputs from the ticket.',
      'Prepare the engagement letter for a ticket: choose the right documents for the services taken, fill every input from the ticket, and flag anything missing before it is sent for signature.',
      'advanced', ['leads', 'documents', 'services'], ['set_services'], ['pages'], true, 37, 14),
    a('a4', 'Research Assistant', 'Looks things up outside the portal, like legal updates and court information.',
      'Answer research questions using the web. Always name where the information came from, say how recent it is, and never present anything as legal advice.',
      'advanced', ['services'], [], ['web', 'pages', 'api'], true, 21, 5),
    a('a5', 'Daily Briefing', 'Summarises what needs attention each morning.',
      'Every morning, list overdue tasks, contracts waiting for a signature and leads with no next step, in order of urgency.',
      'balanced', ['leads', 'tasks', 'campaigns'], ['book_task'], [], false, 0, 1),
  ]
}

/** One standing thread per bot, started by the bot, like a messenger. */
export const conversations = (list: Bot[]): ChatConversation[] => {
  const now = Date.now()
  const hello: Record<string, [string, number, boolean]> = {
    a1: ['Good morning. Tell me about a new enquiry and I will check it, draft a first reply and book the call. Try: create a lead for Priya Shah.', 20 * 60_000, true],
    a2: ['Some leads go quiet after the first call. Ask me to text one of them and I will word it for you. Try: text Rachel Greene saying …', 3 * 3_600_000, true],
    a3: ['Tell me which ticket to prepare the engagement letter for and I will set its services first.', 26 * 3_600_000, false],
    a4: ['I work outside the portal. Ask me to look something up, like a recent change in filing rules.', 2 * DAY, false],
  }
  return list.filter(b => hello[b.id]).map(b => {
    const [text, ago, unread] = hello[b.id]
    return { id: 'thread-' + b.id, title: b.name, botId: b.id, createdAt: now - ago, updatedAt: now - ago, unread, messages: [{ id: 'm-' + b.id, role: 'assistant' as const, text, at: now - ago }] }
  })
}
