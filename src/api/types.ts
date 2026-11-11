// Shared data contracts. The real backend should return these shapes.

export type StageId = 'new' | 'contacted' | 'consult' | 'contract' | 'signed' | 'payment' | 'delivered' | 'lost'
export type SourceId = 'web' | 'email' | 'text' | 'manual' | 'referral' | 'ads'
export type ActivityType = 'enquiry' | 'auto' | 'text' | 'email' | 'call' | 'meeting' | 'doc' | 'signed' | 'stage' | 'reminder' | 'lost'

export interface Activity {
  t: number
  type: ActivityType
  /** '' normal, 'auto' sent by automation, 'good' positive milestone, 'bad' held/failed/lost */
  cls: '' | 'auto' | 'good' | 'bad'
  title: string
  text?: string
  quote?: string
}

/** One document inside a signing packet, with the values the sender filled in from the ticket. */
export interface SentItem { templateId: string; name: string; values: Record<string, string> }

/** The documents sent to a lead for signature (a packet; signing completes all of them together). */
export interface EngagementDoc {
  status: 'sent' | 'signed'
  sent: number
  signed?: number
  by?: string
  items?: SentItem[]
}

/** Where a document input gets its value. 'manual' is typed in when the document is sent. */
export type FieldSource = 'name' | 'email' | 'phone' | 'matter' | 'practice' | 'fee' | 'owner' | 'source' | 'services' | 'today' | 'firm' | 'manual'
export type FieldKind = 'text' | 'longtext' | 'money' | 'date'
export interface DocField { id: string; label: string; source: FieldSource; kind: FieldKind; required?: boolean }
export interface DocFile { name: string; size: number; type: string; uploadedAt: number }
export const DOC_CATEGORIES = ['Engagement', 'Fees', 'Intake', 'Compliance', 'Other'] as const
export type DocCategory = typeof DOC_CATEGORIES[number]

/** A document in the library: the uploaded file plus the inputs it needs. */
export interface PortalDocument {
  id: string
  name: string
  category: DocCategory
  description: string
  file: DocFile | null
  fields: DocField[]
  /** Only active documents can be sent from a ticket. */
  active: boolean
  createdAt: number
  updatedAt: number
  updatedBy: string
}


export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  matter: string
  practice: string
  source: SourceId
  value: number
  stage: StageId
  owner: string
  created: number
  activities: Activity[]
  doc: EngagementDoc | null
  lostReason: string | null
  optedOut?: boolean
  /** Free-text notes captured when the enquiry was added. */
  notes?: string
  /** The services the lead is taking, chosen from the Services catalog after the consultation. */
  serviceIds?: string[]
}

export type TaskType = 'task' | 'call' | 'meeting' | 'follow_up' | 'deadline'

export interface Task {
  id: string
  type: TaskType
  title: string
  dueAt: number
  done: boolean
  completedAt?: number
  assignedTo: string
  leadId?: string
  notes?: string
  /** Created by a pipeline stage change; closed automatically when the stage moves on. */
  auto?: boolean
}

export interface FirmEvent { id: string; t: number; dur: number; title: string; who: string }

export interface Integration { id: string; name: string; icon: string; on: boolean; desc: string }

export interface Firm {
  name: string
  domain: string
  number: string
  domainStatus: 'unverified' | 'pending' | 'verified'
  textStatus: 'unregistered' | 'review' | 'registered'
}

export type CampaignChannel = 'Text' | 'Email' | 'Text and Email'
export type AudienceKey = 'open' | 'consult' | 'clients' | 'lost' | 'all'

export interface Recipient {
  id: string
  name: string
  channel: 'Text' | 'Email'
  status: 'delivered' | 'held' | 'skipped'
  at?: number
  opened?: boolean
  replied?: boolean
}

export interface Campaign {
  id: string
  kind: 'auto' | 'broadcast'
  name: string
  channel: CampaignChannel
  steps: number
  sent: number
  subject?: string
  body: string
  recipients: Recipient[]
  trigger?: string
  active?: boolean
  audience?: AudienceKey
  sentAt?: number
}

export interface SendProgress { id: string; total: number; done: number }

export interface TeamMember { name: string; role: string; permission: 'Admin' | 'Member' }

export interface NewLeadInput {
  name: string; phone?: string; practice: string; matter: string; value?: number; note?: string
}
export interface NewCampaignInput {
  kind: 'auto' | 'broadcast'; name: string; channel: CampaignChannel; subject?: string; body: string
  audience?: AudienceKey; trigger?: string
}

/** Metadata the UI needs to render forms and labels. Served by the backend as configuration. */
export interface PortalConfig {
  stages: { id: StageId; label: string; next: string }[]
  sources: Record<SourceId, string>
  owners: string[]
  lostReasons: string[]
  practiceAreas: string[]
  triggers: string[]
  audiences: Record<AudienceKey, { label: string; hint: string }>
}

export interface SearchHit {
  group: 'Leads' | 'Tasks' | 'Messages' | 'Documents' | 'Services' | 'Campaigns'
  title: string
  subtitle: string
  /** What the UI should open: a lead, an task (opens Tasks), or a campaign. */
  target: { type: 'lead' | 'tasks' | 'campaign' | 'document' | 'service'; id: string }
}

export type PricingModel = 'flat' | 'hourly' | 'monthly' | 'contingency'
export const PRICING_MODELS: Record<PricingModel, string> = { flat: 'Flat fee', hourly: 'Hourly', monthly: 'Monthly', contingency: 'Contingency' }

/** A service the firm provides, with its default pricing. Picking one when adding an enquiry starts from these numbers. */
export interface Service {
  id: string
  name: string
  /** One of the firm's practice areas. */
  practice: string
  description: string
  pricingModel: PricingModel
  /** flat: fee ($) · hourly: rate ($/hr) · monthly: fee ($/mo) · contingency: percentage (%) */
  price: number
  /** Upfront retainer collected before work starts (the Payment Pending stage). */
  retainer: number
  active: boolean
  createdAt: number
  updatedAt: number
}
