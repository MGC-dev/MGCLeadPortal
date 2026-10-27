export type LeadStatus =
  | 'new' | 'contacted' | 'follow_up' | 'consultation' | 'attorney_review' | 'strategy'
  | 'pending' | 'engagement_sent' | 'payment_link_sent' | 'payment_plan' | 'retained' | 'lost'

export type PricingModel = 'flat' | 'hourly' | 'monthly' | 'contingency'

export interface Service {
  id: string
  name: string
  practiceArea: string
  description: string
  pricingModel: PricingModel
  /** flat: fee ($) · hourly: rate ($/hr) · monthly: fee ($/mo) · contingency: percentage (%) */
  price: number
  /** Upfront retainer / deposit collected when the lead is retained */
  retainer: number
  active: boolean
}

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: string
  practiceArea: string
  serviceId?: string
  status: LeadStatus
  value: number
  assignedTo: string
  notes: string
  createdAt: string
  lastContactAt?: string
  clientId?: string
}

export interface Client {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  practiceArea: string
  status: 'active' | 'closed'
  leadId?: string
  since: string
}

export interface Matter {
  id: string
  clientId: string
  title: string
  practiceArea: string
  status: 'open' | 'pending' | 'closed'
  attorney: string
  openedAt: string
}

export type DocStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined'

export interface LegalDocument {
  id: string
  name: string
  kind: string
  recipientName: string
  recipientEmail: string
  clientId?: string
  leadId?: string
  status: DocStatus
  createdAt: string
  sentAt?: string
  signedAt?: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface Invoice {
  id: string
  number: string
  clientId?: string
  /** Set while the payer is still a lead (e.g. retainer payment link sent during intake) */
  leadId?: string
  matterId?: string
  type: 'retainer' | 'invoice'
  description: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  paidAt?: string
  method?: string
}

export type StepType = 'email' | 'sms' | 'wait' | 'task'

export interface CampaignStep {
  id: string
  type: StepType
  delayDays: number
  subject: string
  body: string
}

export type CampaignTrigger = 'lead_created' | 'consultation_booked' | 'proposal_sent' | 'client_retained' | 'invoice_overdue' | 'manual'

export interface Campaign {
  id: string
  name: string
  trigger: CampaignTrigger
  status: 'active' | 'paused' | 'draft'
  steps: CampaignStep[]
  stats: { enrolled: number; sent: number; opened: number; replied: number; converted: number }
  createdAt: string
}

export interface Activity {
  id: string
  entityType: 'lead' | 'client' | 'document' | 'invoice'
  entityId: string
  text: string
  at: string
}

export type AgendaType = 'task' | 'call' | 'meeting' | 'follow_up' | 'deadline'

export interface AgendaItem {
  id: string
  type: AgendaType
  title: string
  dueAt: string
  done: boolean
  completedAt?: string
  assignedTo: string
  leadId?: string
  clientId?: string
  notes?: string
  /** Created automatically by a pipeline stage change; closed automatically when the stage moves on */
  auto?: boolean
}

export type Channel = 'email' | 'sms'

export interface Message {
  id: string
  channel: Channel
  direction: 'in' | 'out'
  leadId?: string
  clientId?: string
  subject?: string
  body: string
  at: string
  /** What produced it: a campaign name, 'Documents', 'Payments' or blank for manual */
  source?: string
}

export const AGENDA_TYPES: Record<AgendaType, string> = { task: 'Task', call: 'Call', meeting: 'Meeting', follow_up: 'Follow-up', deadline: 'Deadline' }

export const LEAD_STAGES: { key: LeadStatus; label: string }[] = [
  { key: 'new', label: 'New Lead' },
  { key: 'contacted', label: 'Contact Attempted' },
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'consultation', label: 'Discovery Call Scheduled' },
  { key: 'attorney_review', label: 'Attorney Review Required' },
  { key: 'strategy', label: 'Strategy Session Scheduled' },
  { key: 'pending', label: 'Pending Engagement / Payment' },
  { key: 'engagement_sent', label: 'Engagement Sent' },
  { key: 'payment_link_sent', label: 'Payment Link Sent' },
  { key: 'payment_plan', label: 'Payment Plan Pending' },
  { key: 'retained', label: 'Retained' },
  { key: 'lost', label: 'Lost' },
]

export const ENGAGEMENT_KINDS = ['Retainer Agreement', 'Engagement Letter', 'Fee Agreement']

export const PRICING_MODELS: Record<PricingModel, string> = { flat: 'Flat fee', hourly: 'Hourly', monthly: 'Monthly', contingency: 'Contingency' }

export const PRACTICE_AREAS = ['Family Law', 'Personal Injury', 'Immigration', 'Estate Planning', 'Criminal Defense', 'Business Law', 'Employment', 'Real Estate']
export const SOURCES = ['Website', 'Referral', 'Google Ads', 'Facebook', 'Walk-in', 'Avvo', 'Phone']
export const ATTORNEYS = ['Sarah Mitchell', 'David Cohen', 'Priya Nair', 'James Okafor']
export const TRIGGERS: Record<CampaignTrigger, string> = {
  lead_created: 'New lead is created',
  consultation_booked: 'Discovery call is scheduled',
  proposal_sent: 'Engagement letter is sent',
  client_retained: 'Lead becomes a client',
  invoice_overdue: 'Invoice becomes overdue',
  manual: 'Manually enrolled',
}
