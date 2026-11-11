import { campaignsApi, firmApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Campaign, Lead } from '../../api/types'

export const AUDIENCES = config.audiences
export const TRIGGERS = config.triggers
/** Fills {first}, {matter} and {firm} merge fields for a preview. */
export const fillIn = (s: string, l: Lead | null | undefined, firmName: string) =>
  s.replace(/\{first\}/g, l ? l.name.split(' ')[0] : 'Rachel').replace(/\{matter\}/g, l ? l.matter.toLowerCase() : 'custody question').replace(/\{firm\}/g, firmName)

export function campStats(c: Campaign) {
  const r = c.recipients
  return {
    sent: r.filter(x => x.status === 'delivered').length, held: r.filter(x => x.status === 'held').length, skipped: r.filter(x => x.status === 'skipped').length,
    opened: r.filter(x => x.opened).length, replied: r.filter(x => x.replied).length, email: r.filter(x => x.channel === 'Email' && x.status === 'delivered').length,
  }
}
export const useCampaigns = () => useQuery(() => campaignsApi.list())
export const useFirm = () => useQuery(() => firmApi.get())
