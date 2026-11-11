import { config } from '../../api/mockData'
import type { ActivityType, Task, Lead } from '../../api/types'

export const SOURCES = config.sources
export const STAGES = config.stages
export const STAGE = Object.fromEntries(STAGES.map((s, i) => [s.id, { ...s, i }]))
export const isWon = (l: Lead) => l.stage === 'signed' || l.stage === 'payment' || l.stage === 'delivered'
/**
 * A lead becomes a contact once it has been provided a service and reaches this stage.
 * From then on it appears in Contacts and no longer in Leads (and the other way round if it is moved back).
 */
export const CONTACT_STAGE = 'delivered' as const
export const isContact = (l: Lead) => l.stage === CONTACT_STAGE
/** When a contact became one: the last time it was moved to the contact stage. */
export const contactSince = (l: Lead): number => [...l.activities].reverse().find(a => /services provided/i.test(a.title))?.t ?? l.created
export const isOpen = (l: Lead) => !['delivered', 'lost'].includes(l.stage)
/** The estimated fee only exists once the services are known, which is after the consultation (not for the first three stages). */
export const feeKnown = (l: Lead) => l.stage !== 'lost' && STAGE[l.stage].i >= 3
export const SRC_ICON: Record<string, string> = { web: 'globe', email: 'mail', text: 'messages', manual: 'phone', referral: 'leads', ads: 'bolt' }
export const ACT_ICON: Record<ActivityType, string> = { enquiry: 'globe', auto: 'bolt', text: 'messages', email: 'mail', call: 'phone', meeting: 'calendar', doc: 'doc', signed: 'check', stage: 'arrow', reminder: 'bell', lost: 'x' }

export interface NextStep { text: string; due: number | null }
/** A lead's next step is its earliest open task, or the stage's default when none is booked. */
export function nextStep(l: Lead, tasks: Task[]): NextStep {
  if (l.stage === 'lost') return { text: 'Closed as lost', due: null }
  const mine = tasks.filter(a => a.leadId === l.id && !a.done).sort((a, b) => a.dueAt - b.dueAt)[0]
  return mine ? { text: mine.title, due: mine.dueAt } : { text: STAGE[l.stage].next, due: null }
}
