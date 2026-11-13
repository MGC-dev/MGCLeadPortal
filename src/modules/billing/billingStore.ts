import { useSyncExternalStore } from 'react'
import type { Invoice, InvoiceInput, Payment, PaymentPlan, Installment } from './types'
const STORAGE_KEY='unir-billing-frontend-v2'; const now=Date.now(); const day=86400000
const seed:Invoice[]=[
 {id:'inv_1001',number:'INV-1001',customerName:'John Smith',customerEmail:'john.smith@example.com',invoiceDate:now-18*day,dueDate:now-3*day,currency:'USD',items:[{id:'it1',description:'Immigration consultation and case strategy',quantity:1,unitPrice:2500}],subtotal:2500,discount:0,taxRate:0,taxAmount:0,total:2500,amountPaid:2500,balanceDue:0,status:'paid',lateFeeAmount:0,lateFeeRule:'No late fee applied',createdBy:'Alex Morgan',updatedBy:'Alex Morgan',createdAt:now-18*day,updatedAt:now-2*day,activity:[{id:'a1',action:'Invoice created',by:'Alex Morgan',at:now-18*day},{id:'a2',action:'Payment recorded',by:'Alex Morgan',at:now-2*day,detail:'Full payment received'}]},
 {id:'inv_1002',number:'INV-1002',customerName:'Sarah Wilson',customerEmail:'sarah.wilson@example.com',invoiceDate:now-8*day,dueDate:now+7*day,currency:'USD',items:[{id:'it2',description:'Legal professional services',quantity:1,unitPrice:1800}],subtotal:1800,discount:0,taxRate:0,taxAmount:0,total:1800,amountPaid:500,balanceDue:1300,status:'partially_paid',lateFeeAmount:0,lateFeeRule:'No late fee applied',createdBy:'Jordan Lee',updatedBy:'Jordan Lee',createdAt:now-8*day,updatedAt:now-1*day,activity:[{id:'a3',action:'Invoice created',by:'Jordan Lee',at:now-8*day},{id:'a4',action:'Partial payment recorded',by:'Jordan Lee',at:now-1*day,detail:'500.00 received'}]},
 {id:'inv_1003',number:'INV-1003',customerName:'David Brown',customerEmail:'david.brown@example.com',invoiceDate:now-35*day,dueDate:now-12*day,currency:'USD',items:[{id:'it3',description:'Family law services',quantity:1,unitPrice:3200}],subtotal:3200,discount:0,taxRate:0,taxAmount:0,total:3200,amountPaid:0,balanceDue:3200,status:'overdue',lateFeeAmount:0,lateFeeRule:'Late fee policy not configured',createdBy:'Alex Morgan',updatedBy:'Alex Morgan',createdAt:now-35*day,updatedAt:now-12*day,activity:[{id:'a5',action:'Invoice created',by:'Alex Morgan',at:now-35*day}]},
 {id:'inv_1004',number:'INV-1004',customerName:'Maria Garcia',customerEmail:'maria.garcia@example.com',invoiceDate:now-2*day,dueDate:now+28*day,currency:'USD',items:[{id:'it4',description:'Business formation services',quantity:1,unitPrice:4500}],subtotal:4500,discount:250,taxRate:0,taxAmount:0,total:4250,amountPaid:0,balanceDue:4250,status:'sent',lateFeeAmount:0,lateFeeRule:'No late fee applied',createdBy:'Jordan Lee',updatedBy:'Jordan Lee',createdAt:now-2*day,updatedAt:now-2*day,activity:[{id:'a6',action:'Invoice created',by:'Jordan Lee',at:now-2*day}]},
]
const seedPayments:Payment[]=[{id:'pay_01',reference:'PAY-0001',invoiceId:'inv_1001',invoiceNumber:'INV-1001',customerName:'John Smith',date:now-2*day,method:'Card',amount:2500,currency:'USD',status:'completed',transactionId:'TXN-DEMO-1001',createdBy:'Alex Morgan'},{id:'pay_02',reference:'PAY-0002',invoiceId:'inv_1002',invoiceNumber:'INV-1002',customerName:'Sarah Wilson',date:now-1*day,method:'Bank transfer',amount:500,currency:'USD',status:'completed',transactionId:'TXN-DEMO-1002',createdBy:'Jordan Lee'}]
let invoices=loadInvoices(), payments=load('payments',seedPayments) as Payment[], plans=load('plans',[{id:'plan_01',name:'Sarah Wilson - Monthly Plan',customerName:'Sarah Wilson',invoiceId:'inv_1002',invoiceNumber:'INV-1002',total:1800,currency:'USD',downPayment:500,installmentAmount:325,frequency:'Monthly',startDate:now-1*day,status:'Active',createdBy:'Jordan Lee'}] as PaymentPlan[]), installments=load('installments',[{id:'ins_01',planId:'plan_01',invoiceNumber:'INV-1002',customerName:'Sarah Wilson',dueDate:now+29*day,amount:325,paid:0,status:'Upcoming'},{id:'ins_02',planId:'plan_01',invoiceNumber:'INV-1002',customerName:'Sarah Wilson',dueDate:now+59*day,amount:325,paid:0,status:'Upcoming'}] as Installment[])
let version=0; const listeners=new Set<()=>void>();
function loadInvoices():Invoice[]{try{const x=localStorage.getItem(STORAGE_KEY)??localStorage.getItem('unir-billing-frontend-v1');if(x){const p=JSON.parse(x);if(Array.isArray(p))return p.map((v:any)=>({...v,lateFeeAmount:v.lateFeeAmount??0,lateFeeRule:v.lateFeeRule??'Not configured',createdBy:v.createdBy??'Previously created',updatedBy:v.updatedBy??'Previously updated',activity:v.activity??[{id:uid('act'),action:'Imported from previous billing preview',by:'System',at:v.createdAt??Date.now()}]}))}}catch{} return structuredClone(seed)}
function load<T>(key:string,fallback:T):T{try{const x=localStorage.getItem(`${STORAGE_KEY}-${key}`);if(x)return JSON.parse(x) as T}catch{}return structuredClone(fallback)}
function commit(){version++;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(invoices));localStorage.setItem(`${STORAGE_KEY}-payments`,JSON.stringify(payments));localStorage.setItem(`${STORAGE_KEY}-plans`,JSON.stringify(plans));localStorage.setItem(`${STORAGE_KEY}-installments`,JSON.stringify(installments))}catch{}listeners.forEach(f=>f())}
const uid=(p:string)=>`${p}_${Math.random().toString(36).slice(2,9)}`
function buildInstallmentSchedule(plan:PaymentPlan,alreadyPaid:number):Installment[]{
 const remaining=Math.max(0,plan.total-plan.downPayment-alreadyPaid);
 if(remaining<=0||plan.installmentAmount<=0)return [];
 const count=Math.ceil(remaining/plan.installmentAmount);
 const due=new Date(plan.startDate);
 const rows:Installment[]=[];
 for(let i=0;i<count;i++){
  if(i>0){
   if(plan.frequency==='Weekly')due.setDate(due.getDate()+7);
   else if(plan.frequency==='Biweekly')due.setDate(due.getDate()+14);
   else {const dayOfMonth=due.getDate();due.setDate(1);due.setMonth(due.getMonth()+1);const lastDay=new Date(due.getFullYear(),due.getMonth()+1,0).getDate();due.setDate(Math.min(dayOfMonth,lastDay));}
  }
  const amount=Math.min(plan.installmentAmount,remaining-i*plan.installmentAmount);
  rows.push({id:uid('inst'),planId:plan.id,invoiceNumber:plan.invoiceNumber,customerName:plan.customerName,dueDate:due.getTime(),amount,paid:0,status:'Upcoming'});
 }
 return rows
}
export const billingStore={get:()=>invoices,getPayments:()=>payments,getPlans:()=>plans,getInstallments:()=>installments,version:()=>version,subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn)},
 getById(id:string){return invoices.find(x=>x.id===id)},
 create(input:InvoiceInput){const items=input.items.map((x)=>({...x,id:uid('item')}));const subtotal=items.reduce((s,x)=>s+x.quantity*x.unitPrice,0);const discount=Math.max(0,input.discount);const taxAmount=Math.max(0,subtotal-discount)*Math.max(0,input.taxRate)/100;const total=Math.max(0,subtotal-discount+taxAmount);const t=Date.now();const inv:Invoice={...input,id:uid('inv'),number:`INV-${1000+invoices.length+1}`,items,subtotal,discount,taxAmount,total,amountPaid:0,balanceDue:total,status:'draft',lateFeeAmount:0,lateFeeRule:'Not configured',createdBy:'Current user',updatedBy:'Current user',createdAt:t,updatedAt:t,activity:[{id:uid('act'),action:'Invoice created',by:'Current user',at:t}]};invoices=[inv,...invoices];commit();return inv},
 update(id:string,input:InvoiceInput){const old=invoices.find(x=>x.id===id);if(!old)return;const items=input.items.map(x=>({...x,id:uid('item')}));const subtotal=items.reduce((s,x)=>s+x.quantity*x.unitPrice,0);const discount=Math.max(0,input.discount);const taxAmount=Math.max(0,subtotal-discount)*Math.max(0,input.taxRate)/100;const total=Math.max(0,subtotal-discount+taxAmount);const t=Date.now();const updated={...old,...input,items,subtotal,discount,taxAmount,total,balanceDue:Math.max(0,total-old.amountPaid),status:old.amountPaid>=total?'paid':old.amountPaid>0?'partially_paid':old.status,updatedAt:t,updatedBy:'Current user',activity:[{id:uid('act'),action:'Invoice updated',by:'Current user',at:t},...old.activity]};invoices=invoices.map(x=>x.id===id?updated:x);commit();return updated},
 addPayment(input:Omit<Payment,'id'|'reference'|'invoiceNumber'|'customerName'|'currency'|'createdBy'>){const inv=invoices.find(x=>x.id===input.invoiceId);if(!inv)return;const payment:Payment={...input,id:uid('pay'),reference:`PAY-${String(payments.length+1).padStart(4,'0')}`,invoiceNumber:inv.number,customerName:inv.customerName,currency:inv.currency,createdBy:'Current user'};payments=[payment,...payments];if(payment.status==='completed'){const paid=Math.min(inv.total,inv.amountPaid+payment.amount);const status=paid>=inv.total?'paid':'partially_paid';const t=Date.now();invoices=invoices.map(x=>x.id===inv.id?{...x,amountPaid:paid,balanceDue:Math.max(0,x.total-paid),status,updatedAt:t,updatedBy:'Current user',activity:[{id:uid('act'),action:'Payment recorded',by:'Current user',at:t,detail:`${payment.reference} · ${payment.amount.toFixed(2)}`},...x.activity]}:x)}commit();return payment},
 createPlan(p:Omit<PaymentPlan,'id'|'createdBy'>){const planId=uid('plan');const plan:PaymentPlan={...p,id:planId,createdBy:'Current user'};plans=[plan,...plans];const created=buildInstallmentSchedule(plan,0);installments=[...created,...installments];commit()},
 updatePlan(id:string,updates:Pick<PaymentPlan,'name'|'downPayment'|'installmentAmount'|'frequency'|'startDate'>){
  const existing=plans.find(x=>x.id===id);if(!existing)return;
  if(!updates.name.trim()||updates.installmentAmount<=0||updates.downPayment<0||updates.downPayment>=existing.total)return;
  const history=installments.filter(x=>x.planId===id&&x.paid>0);
  const paidTotal=history.reduce((sum,x)=>sum+Math.min(x.amount,x.paid),0);
  const remainingAfterUpdate=Math.max(0,existing.total-updates.downPayment-paidTotal);
  const revised:PaymentPlan={...existing,...updates,status:remainingAfterUpdate===0?'Completed':existing.status==='Paused'?'Paused':'Active'};
  // Fully paid rows remain unchanged. Partially paid rows remain as history but are marked
  // rescheduled; their unpaid balance is included in the newly generated schedule.
  const preserved=history.map(x=>x.paid>=x.amount?x:{...x,status:'Rescheduled' as const});
  const created=buildInstallmentSchedule(revised,paidTotal);
  plans=plans.map(x=>x.id===id?revised:x);
  installments=[...created,...installments.filter(x=>x.planId!==id),...preserved];
  commit();return revised
 },
}
export function useInvoices(){useSyncExternalStore(billingStore.subscribe,billingStore.version);return billingStore.get()}
export function usePayments(){useSyncExternalStore(billingStore.subscribe,billingStore.version);return billingStore.getPayments()}
export function usePlans(){useSyncExternalStore(billingStore.subscribe,billingStore.version);return billingStore.getPlans()}
export function useInstallments(){useSyncExternalStore(billingStore.subscribe,billingStore.version);return billingStore.getInstallments()}
