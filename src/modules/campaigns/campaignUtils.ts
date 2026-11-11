import { campaignsApi, firmApi, useQuery } from '../../api'
import { config } from '../../api/mockData'
import type { Campaign, CampaignTag, Lead } from '../../api/types'
import { SOURCE_OPTIONS, prefillValue, sourceLabel } from '../documents/documentFields'

/** The placeholders a campaign message can use, and where each is filled from on the ticket. */
export const INPUTS = [
  { token: '{first}', label: 'First name', from: 'Ticket · Name' },
  { token: '{matter}', label: 'Matter', from: 'Ticket · Matter' },
  { token: '{firm}', label: 'Firm name', from: 'Firm settings' },
] as const
export const AUDIENCES = config.audiences
export const TRIGGERS = config.triggers
/** Fills {first}, {matter} and {firm} merge fields for a preview. */
export const fillIn = (s: string, l: Lead | null | undefined, firmName: string, tags: CampaignTag[] = [], serviceNames = '') => {
  let out = s.replace(/\{first\}/g, l ? l.name.split(' ')[0] : 'Rachel').replace(/\{matter\}/g, l ? l.matter.toLowerCase() : 'custody question').replace(/\{firm\}/g, firmName)
  for (const g of tags) out = out.split(`{${g.id}}`).join(l ? prefillValue({ id: g.id, label: g.label, source: g.source, kind: 'text' }, l, firmName, serviceNames) : g.label)
  return out
}

/** Every input a message can use: the built-in three plus the ones added to this campaign. */
export const allInputs = (tags: CampaignTag[] = []) => [
  ...INPUTS.map(x => ({ token: x.token as string, label: x.label as string, from: x.from as string, custom: false })),
  ...tags.map(g => ({ token: `{${g.id}}`, label: g.label, from: sourceLabel(g.source), custom: true })),
]
/** Where a new input can be filled from: anything on the ticket, or the firm and the date (not typed by hand). */
export const TAG_SOURCES = SOURCE_OPTIONS.filter(o => o.value !== 'manual')
/** A unique {tag} id from a label, e.g. "Client phone" becomes client_phone. */
export const tagId = (label: string, taken: string[]) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'input'
  let id = base, n = 2
  while (taken.includes(id) || ['first', 'matter', 'firm'].includes(id)) id = `${base}_${n++}`
  return id
}

export function campStats(c: Campaign) {
  const r = c.recipients
  return {
    sent: r.filter(x => x.status === 'delivered').length, held: r.filter(x => x.status === 'held').length, skipped: r.filter(x => x.status === 'skipped').length,
    opened: r.filter(x => x.opened).length, replied: r.filter(x => x.replied).length, email: r.filter(x => x.channel === 'Email' && x.status === 'delivered').length,
  }
}
/** NPS: promoters (9 to 10) minus detractors (0 to 6). CSAT: the average, and how many scored 4 or 5. */
export function surveyStats(c: Campaign) {
  const scores = c.recipients.filter(r => r.score !== undefined).map(r => r.score!)
  const n = scores.length
  const delivered = c.recipients.filter(r => r.status === 'delivered').length
  const base = { n, delivered, rate: delivered ? Math.round(n / delivered * 100) : 0 }
  if (c.metric === 'csat') {
    const sat = scores.filter(s => s >= 4).length
    return { ...base, score: n ? scores.reduce((a, b) => a + b, 0) / n : 0, satisfied: sat, neutral: scores.filter(s => s === 3).length, unhappy: scores.filter(s => s <= 2).length, pct: n ? Math.round(sat / n * 100) : 0 }
  }
  const pro = scores.filter(s => s >= 9).length, det = scores.filter(s => s <= 6).length
  return { ...base, score: n ? Math.round((pro - det) / n * 100) : 0, promoters: pro, passives: n - pro - det, detractors: det }
}
/** "+43" for NPS, "4.4" for CSAT. */
export const scoreLabel = (c: Campaign): string => {
  const s = surveyStats(c)
  if (!s.n) return '—'
  return c.metric === 'csat' ? s.score.toFixed(1) : (s.score > 0 ? '+' : '') + s.score
}
export const kindLabel = (c: Campaign) => (c.kind === 'auto' ? 'Automatic' : c.kind === 'survey' ? (c.metric === 'csat' ? 'CSAT survey' : 'NPS survey') : 'One-off')
export const useCampaigns = () => useQuery(() => campaignsApi.list())
export const useFirm = () => useQuery(() => firmApi.get())

/** Puts a tag into a message at the caret (or the end when the box has not been used), with a space around it where needed. */
export function insertTag(text: string, token: string, caret?: { s: number; e: number } | null) {
  const s = Math.min(caret?.s ?? text.length, text.length), e = Math.min(caret?.e ?? s, text.length)
  const before = text.slice(0, s), after = text.slice(e)
  const lead = before && !/\s$/.test(before) ? ' ' : '', trail = after && !/^[\s.,!?;:]/.test(after) ? ' ' : ''
  const ins = lead + token + trail
  return { text: before + ins + after, caret: s + ins.length }
}
