import type { DocField, FieldKind, FieldSource, Lead } from '../../api/types'
import { config } from '../../api/mockData'
import { money } from '../../shared/format'

/** Where a document input gets its value from. Everything except "manual" is read from the ticket. */
export const SOURCE_OPTIONS: { value: FieldSource; label: string; group: 'Ticket' | 'Other' }[] = [
  { value: 'name', label: 'Client name', group: 'Ticket' },
  { value: 'email', label: 'Client email', group: 'Ticket' },
  { value: 'phone', label: 'Client phone', group: 'Ticket' },
  { value: 'matter', label: 'Matter', group: 'Ticket' },
  { value: 'practice', label: 'Practice area', group: 'Ticket' },
  { value: 'fee', label: 'Estimated fee', group: 'Ticket' },
  { value: 'owner', label: 'Owner (attorney)', group: 'Ticket' },
  { value: 'source', label: 'Enquiry source', group: 'Ticket' },
  { value: 'services', label: 'Selected services', group: 'Ticket' },
  { value: 'today', label: 'Today’s date', group: 'Other' },
  { value: 'firm', label: 'Firm name', group: 'Other' },
  { value: 'manual', label: 'Typed in when sending', group: 'Other' },
]
export const sourceLabel = (s: FieldSource) => SOURCE_OPTIONS.find(o => o.value === s)?.label ?? s
export const fromTicket = (s: FieldSource) => SOURCE_OPTIONS.find(o => o.value === s)?.group === 'Ticket'
export const KIND_OPTIONS: { value: FieldKind; label: string }[] = [
  { value: 'text', label: 'Text' }, { value: 'longtext', label: 'Long text' }, { value: 'money', label: 'Amount' }, { value: 'date', label: 'Date' },
]
export const kindLabel = (k: FieldKind) => KIND_OPTIONS.find(o => o.value === k)?.label ?? k

/** The value one input starts with when sending, taken from the ticket (empty when it must be typed in). */
export function prefillValue(f: DocField, lead: Lead, firmName: string, serviceNames = ''): string {
  switch (f.source) {
    case 'name': return lead.name
    case 'email': return lead.email
    case 'phone': return lead.phone
    case 'matter': return lead.matter
    case 'practice': return lead.practice
    case 'fee': return money(lead.value)
    case 'owner': return lead.owner
    case 'source': return config.sources[lead.source]
    case 'services': return serviceNames
    case 'today': return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    case 'firm': return firmName
    default: return ''
  }
}
export const prefill = (fields: DocField[], lead: Lead, firmName: string, serviceNames = ''): Record<string, string> =>
  Object.fromEntries(fields.map(f => [f.id, prefillValue(f, lead, firmName, serviceNames)]))
