import type { PricingModel, Service } from '../../api/types'
import { defaultFee } from '../../api/mockData'
import { money } from '../../shared/format'

/** "$3,500", "$350/hr", "$3,000/mo" or "33%" */
export const priceLabel = (s: Pick<Service, 'pricingModel' | 'price'>): string =>
  ({ flat: money(s.price), hourly: `${money(s.price)}/hr`, monthly: `${money(s.price)}/mo`, contingency: `${s.price}%` })[s.pricingModel]

/** What the price means, for captions. */
export const priceUnit: Record<PricingModel, string> = {
  flat: 'one-time fee', hourly: 'per hour', monthly: 'per month', contingency: 'of the amount recovered',
}

export const retainerLabel = (s: Pick<Service, 'retainer'>): string => (s.retainer > 0 ? money(s.retainer) : 'None')

/** Digits (and a decimal point) from what someone typed, as a number. */
export const parseAmount = (v: string): number => Number(String(v).replace(/[^\d.]/g, '')) || 0

/** Estimated fee for a set of services: the sum of their default fees. */
export const feeOf = (list: Service[]): number => list.reduce((a, s) => a + defaultFee(s), 0)
export const retainerOf = (list: Service[]): number => list.reduce((a, s) => a + s.retainer, 0)
/** What to request at Payment Pending: the retainers, or the whole estimated fee when the services have none. */
export const paymentDue = (list: Service[]): number => (retainerOf(list) > 0 ? retainerOf(list) : feeOf(list))
