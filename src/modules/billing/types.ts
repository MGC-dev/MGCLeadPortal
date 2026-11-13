export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void'
export type BillingCurrency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
export interface InvoiceItem { id: string; description: string; quantity: number; unitPrice: number }
export interface InvoiceActivity { id: string; action: string; by: string; at: number; detail?: string }
export interface Invoice {
  id: string; number: string; customerName: string; customerEmail: string; relatedLeadId?: string
  invoiceDate: number; dueDate: number; currency: BillingCurrency; items: InvoiceItem[]
  subtotal: number; discount: number; taxRate: number; taxAmount: number; total: number
  amountPaid: number; balanceDue: number; status: InvoiceStatus; notes?: string
  lateFeeAmount: number; lateFeeRule: string; createdBy: string; updatedBy: string
  createdAt: number; updatedAt: number; activity: InvoiceActivity[]
}
export interface InvoiceInput {
  customerName: string; customerEmail: string; relatedLeadId?: string; invoiceDate: number; dueDate: number
  currency: BillingCurrency; items: Omit<InvoiceItem, 'id'>[]; discount: number; taxRate: number; notes?: string
}
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded'
export interface Payment { id:string; reference:string; invoiceId:string; invoiceNumber:string; customerName:string; date:number; method:'Card'|'Bank transfer'|'Check'|'Cash'|'Other'; amount:number; currency:BillingCurrency; status:PaymentStatus; transactionId?:string; note?:string; createdBy:string }
export interface PaymentPlan { id:string; name:string; customerName:string; invoiceId:string; invoiceNumber:string; total:number; currency:BillingCurrency; downPayment:number; installmentAmount:number; frequency:'Monthly'|'Biweekly'|'Weekly'; startDate:number; status:'Active'|'Completed'|'Paused'; createdBy:string }
export interface Installment { id:string; planId:string; invoiceNumber:string; customerName:string; dueDate:number; amount:number; paid:number; status:'Upcoming'|'Due'|'Partially paid'|'Paid'|'Overdue'|'Rescheduled' }
