export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void'
export type BillingCurrency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}
export interface Invoice {
  id: string
  number: string
  customerName: string
  customerEmail: string
  relatedLeadId?: string
  invoiceDate: number
  dueDate: number
  currency: BillingCurrency
  items: InvoiceItem[]
  subtotal: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  balanceDue: number
  status: InvoiceStatus
  notes?: string
  createdAt: number
  updatedAt: number
}
export interface InvoiceInput {
  customerName: string
  customerEmail: string
  relatedLeadId?: string
  invoiceDate: number
  dueDate: number
  currency: BillingCurrency
  items: Omit<InvoiceItem, 'id'>[]
  discount: number
  taxRate: number
  notes?: string
}
