export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
export function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return date(iso)
}
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
export const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

import type { PricingModel, Service } from './types'
export function priceLabel(s: Pick<Service, 'pricingModel' | 'price'>) {
  const m: Record<PricingModel, string> = { flat: money(s.price), hourly: `${money(s.price)}/hr`, monthly: `${money(s.price)}/mo`, contingency: `${s.price}% contingency` }
  return m[s.pricingModel]
}
/** Suggested lead value when a service is picked (contingency can't be estimated, so returns undefined). */
export function estimatedValue(s: Service): number | undefined {
  return { flat: s.price, hourly: s.retainer, monthly: s.price * 12, contingency: undefined }[s.pricingModel]
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const dayDiff = (iso: string) => Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000)
export function dayLabel(iso: string) {
  const d = dayDiff(iso)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
export const when = (iso: string) => `${dayLabel(iso)} · ${timeOf(iso)}`
/** value for <input type="datetime-local"> */
export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
