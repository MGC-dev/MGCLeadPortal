import { useSyncExternalStore } from 'react'
import type { Invoice, InvoiceInput } from './types'

const STORAGE_KEY = 'unir-billing-frontend-v1'
const now = Date.now()
const day = 24 * 60 * 60 * 1000

const seed: Invoice[] = [
  { id: 'inv_1001', number: 'INV-1001', customerName: 'John Smith', customerEmail: 'john.smith@example.com', invoiceDate: now-18*day, dueDate: now-3*day, currency: 'USD', items: [{ id:'it1', description:'Immigration consultation', quantity:1, unitPrice:2500 }], subtotal:2500, discount:0, taxRate:0, taxAmount:0, total:2500, amountPaid:2500, balanceDue:0, status:'paid', createdAt:now-18*day, updatedAt:now-2*day },
  { id: 'inv_1002', number: 'INV-1002', customerName: 'Sarah Wilson', customerEmail: 'sarah.wilson@example.com', invoiceDate: now-8*day, dueDate: now+7*day, currency: 'USD', items: [{ id:'it2', description:'Legal professional services', quantity:1, unitPrice:1800 }], subtotal:1800, discount:0, taxRate:0, taxAmount:0, total:1800, amountPaid:500, balanceDue:1300, status:'partially_paid', createdAt:now-8*day, updatedAt:now-1*day },
  { id: 'inv_1003', number: 'INV-1003', customerName: 'David Brown', customerEmail: 'david.brown@example.com', invoiceDate: now-35*day, dueDate: now-12*day, currency: 'USD', items: [{ id:'it3', description:'Family law services', quantity:1, unitPrice:3200 }], subtotal:3200, discount:0, taxRate:0, taxAmount:0, total:3200, amountPaid:0, balanceDue:3200, status:'overdue', createdAt:now-35*day, updatedAt:now-12*day },
  { id: 'inv_1004', number: 'INV-1004', customerName: 'Maria Garcia', customerEmail: 'maria.garcia@example.com', invoiceDate: now-2*day, dueDate: now+28*day, currency: 'USD', items: [{ id:'it4', description:'Business formation services', quantity:1, unitPrice:4500 }], subtotal:4500, discount:250, taxRate:0, taxAmount:0, total:4250, amountPaid:0, balanceDue:4250, status:'sent', createdAt:now-2*day, updatedAt:now-2*day },
  { id: 'inv_1005', number: 'INV-1005', customerName: 'Michael Lee', customerEmail: 'michael.lee@example.com', invoiceDate: now-1*day, dueDate: now+29*day, currency: 'USD', items: [{ id:'it5', description:'Document review', quantity:2, unitPrice:350 }], subtotal:700, discount:0, taxRate:0, taxAmount:0, total:700, amountPaid:0, balanceDue:700, status:'draft', createdAt:now-1*day, updatedAt:now-1*day },
]

let rows: Invoice[] = load()
let version = 0
const listeners = new Set<() => void>()
function load(): Invoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Invoice[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* start with sample data if browser storage is unavailable */ }
  return structuredClone(seed)
}
function commit() {
  version++
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)) } catch { /* demo mode only */ }
  listeners.forEach(fn => fn())
}
const uid = () => `inv_${Math.random().toString(36).slice(2, 9)}`
export const billingStore = {
  get: () => rows,
  version: () => version,
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn) },
  create(input: InvoiceInput): Invoice {
    const items = input.items.map((item, i) => ({ ...item, id: `item_${i+1}_${Math.random().toString(36).slice(2,5)}` }))
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const discount = Math.max(0, input.discount)
    const taxAmount = Math.max(0, subtotal - discount) * Math.max(0, input.taxRate) / 100
    const total = Math.max(0, subtotal - discount + taxAmount)
    const invoice: Invoice = {
      ...input, id: uid(), number: `INV-${1000 + rows.length + 1}`, items, subtotal, discount,
      taxAmount, total, amountPaid: 0, balanceDue: total, status: 'draft', createdAt: Date.now(), updatedAt: Date.now(),
    }
    rows = [invoice, ...rows]
    commit()
    return invoice
  },
  getById(id: string) { return rows.find(row => row.id === id) },
}
export function useInvoices(): Invoice[] {
  useSyncExternalStore(billingStore.subscribe, billingStore.version)
  return billingStore.get()
}
