import type { Activity, AgendaItem, Campaign, Client, Invoice, Lead, LegalDocument, Matter, Message, Service } from '../types'

const day = 86_400_000
const ago = (d: number) => new Date(Date.now() - d * day).toISOString()
const at = (d: number, h: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString() }
const ahead = (d: number) => new Date(Date.now() + d * day).toISOString()

export const seed = {
  agenda: [
    { id: 'g1', type: 'call', title: 'Call Rachel Greene – new inquiry', dueAt: at(0, 15), done: false, assignedTo: 'Sarah Mitchell', leadId: 'l1', auto: true },
    { id: 'g2', type: 'call', title: 'Call Marcus Webb – accident intake', dueAt: at(0, 11), done: false, assignedTo: 'David Cohen', leadId: 'l2', auto: true },
    { id: 'g3', type: 'meeting', title: 'Discovery call – Hannah Lee', dueAt: at(2, 14), done: false, assignedTo: 'Sarah Mitchell', leadId: 'l5', auto: true },
    { id: 'g4', type: 'follow_up', title: 'Follow up on engagement letter – Gary Nolan', dueAt: at(-2, 10), done: false, assignedTo: 'James Okafor', leadId: 'l8', auto: true },
    { id: 'g5', type: 'follow_up', title: 'Confirm retainer payment – Linda Park', dueAt: at(1, 9), done: false, assignedTo: 'Priya Nair', leadId: 'l7', auto: true },
    { id: 'g6', type: 'task', title: 'Attorney review – Omar Haddad', dueAt: at(1, 16), done: false, assignedTo: 'David Cohen', leadId: 'l6', auto: true },
    { id: 'g7', type: 'task', title: 'Send HIPAA authorization to Daniel Brooks', dueAt: at(0, 17), done: false, assignedTo: 'David Cohen', clientId: 'c2' },
    { id: 'g8', type: 'deadline', title: 'Filing deadline – Brooks v. Metro Mall', dueAt: at(14, 9), done: false, assignedTo: 'David Cohen', clientId: 'c2' },
    { id: 'g9', type: 'call', title: 'Follow-up call – Elena Petrova', dueAt: at(-1, 13), done: false, assignedTo: 'Priya Nair', leadId: 'l3', auto: true },
    { id: 'g10', type: 'meeting', title: 'Case kickoff – Sofia Reyes', dueAt: at(-7, 11), done: true, completedAt: at(-7, 12), assignedTo: 'Priya Nair', clientId: 'c1' },
    { id: 'g11', type: 'task', title: 'Send LLC formation proposal – Tom Alvarez', dueAt: at(3, 10), done: false, assignedTo: 'James Okafor', leadId: 'l4' },
    { id: 'g12', type: 'meeting', title: 'Strategy session – Linda Park', dueAt: at(-3, 14), done: true, completedAt: at(-3, 15), assignedTo: 'Priya Nair', leadId: 'l7' },
  ] satisfies AgendaItem[],

  messages: [
    { id: 'ms1', channel: 'email', direction: 'in', leadId: 'l1', subject: 'Divorce consultation inquiry', body: 'Hi, I found your firm online. I am looking to file for divorce and have two young children. Could someone call me this afternoon? Thank you, Rachel', at: ago(0.05) },
    { id: 'ms2', channel: 'email', direction: 'out', leadId: 'l1', subject: 'Thanks for contacting us, Rachel', body: 'We received your inquiry about Family Law and an attorney will reach out shortly.', at: ago(0.04), source: 'New Lead Nurture' },
    { id: 'ms3', channel: 'sms', direction: 'in', leadId: 'l2', body: 'Can someone call me today? Thanks – Marcus', at: ago(0.5) },
    { id: 'ms4', channel: 'sms', direction: 'out', leadId: 'l3', body: 'Hi Elena, following up on your green card inquiry. Is tomorrow at 1pm a good time to talk?', at: ago(1) },
    { id: 'ms5', channel: 'email', direction: 'in', leadId: 'l3', subject: 'Re: Green card timeline', body: 'Tomorrow at 1pm works. Can you also tell me how long the process usually takes?', at: ago(0.8) },
    { id: 'ms6', channel: 'email', direction: 'out', leadId: 'l7', subject: 'Please sign: Engagement Letter – Linda Park', body: 'Hi Linda, your engagement letter is ready for signature.', at: ago(2), source: 'Documents' },
    { id: 'ms7', channel: 'email', direction: 'in', leadId: 'l7', subject: 'Signed! Retainer question', body: 'I signed the letter. Can I pay the retainer in two installments?', at: ago(1) },
    { id: 'ms8', channel: 'email', direction: 'out', leadId: 'l5', subject: 'Your consultation is confirmed', body: 'Here is what to bring to your consultation: ID, existing wills, list of assets.', at: ago(3), source: 'Consultation Reminder' },
    { id: 'ms9', channel: 'sms', direction: 'in', leadId: 'l5', body: 'Confirmed, see you Thursday!', at: ago(2.5) },
    { id: 'ms10', channel: 'email', direction: 'out', clientId: 'c2', subject: 'Documents needed for your case', body: 'Hi Daniel, please send medical records and photos of the incident location.', at: ago(4) },
    { id: 'ms11', channel: 'email', direction: 'in', clientId: 'c3', subject: 'Invoice INV-1003 question', body: 'Could you send a breakdown of the October hours? Our accounting team needs it.', at: ago(3) },
    { id: 'ms12', channel: 'email', direction: 'out', clientId: 'c1', subject: 'Welcome to the firm', body: 'Welcome Sofia! Priya Nair will be your point of contact.', at: ago(8) },
  ] satisfies Message[],

  services: [
    { id: 'sv1', name: 'Uncontested Divorce', practiceArea: 'Family Law', description: 'Filing, settlement agreement and final decree for agreed divorces.', pricingModel: 'flat', price: 3500, retainer: 1500, active: true },
    { id: 'sv2', name: 'Contested Divorce & Custody', practiceArea: 'Family Law', description: 'Representation through negotiation, mediation and trial.', pricingModel: 'hourly', price: 350, retainer: 5000, active: true },
    { id: 'sv3', name: 'Personal Injury Claim', practiceArea: 'Personal Injury', description: 'Full representation on a no-win-no-fee basis.', pricingModel: 'contingency', price: 33, retainer: 0, active: true },
    { id: 'sv4', name: 'Family Visa Petition (I-130)', practiceArea: 'Immigration', description: 'Preparation and filing of family-based petitions.', pricingModel: 'flat', price: 2800, retainer: 1500, active: true },
    { id: 'sv5', name: 'Work Visa / Green Card', practiceArea: 'Immigration', description: 'H-1B, PERM and adjustment of status.', pricingModel: 'flat', price: 4200, retainer: 2000, active: true },
    { id: 'sv6', name: 'Will & Living Trust Package', practiceArea: 'Estate Planning', description: 'Will, revocable trust, power of attorney and healthcare directive.', pricingModel: 'flat', price: 3500, retainer: 1750, active: true },
    { id: 'sv7', name: 'DUI / Criminal Defense', practiceArea: 'Criminal Defense', description: 'Defense through arraignment, hearings and trial.', pricingModel: 'flat', price: 9000, retainer: 4500, active: true },
    { id: 'sv8', name: 'LLC Formation', practiceArea: 'Business Law', description: 'Entity formation, operating agreement and EIN setup.', pricingModel: 'flat', price: 1200, retainer: 1200, active: true },
    { id: 'sv9', name: 'Outside General Counsel', practiceArea: 'Business Law', description: 'Ongoing contract review and business advisory.', pricingModel: 'monthly', price: 3000, retainer: 3000, active: true },
    { id: 'sv10', name: 'Wrongful Termination', practiceArea: 'Employment', description: 'Claims and negotiation for unlawful dismissal.', pricingModel: 'hourly', price: 300, retainer: 3000, active: true },
    { id: 'sv11', name: 'Commercial Lease Review', practiceArea: 'Real Estate', description: 'Lease negotiation and dispute resolution.', pricingModel: 'flat', price: 5200, retainer: 2600, active: true },
    { id: 'sv12', name: 'Probate Administration', practiceArea: 'Estate Planning', description: 'Court-supervised estate administration.', pricingModel: 'hourly', price: 275, retainer: 2500, active: false },
  ] satisfies Service[],

  leads: [
    { id: 'l1', serviceId: 'sv2', name: 'Rachel Greene', email: 'rachel.greene@mail.com', phone: '(212) 555-0141', source: 'Google Ads', practiceArea: 'Family Law', status: 'new', value: 6500, assignedTo: 'Sarah Mitchell', notes: 'Seeking divorce consultation. Two children.', createdAt: ago(0) },
    { id: 'l2', serviceId: 'sv3', name: 'Marcus Webb', email: 'marcus.webb@mail.com', phone: '(646) 555-0199', source: 'Referral', practiceArea: 'Personal Injury', status: 'new', value: 28000, assignedTo: 'David Cohen', notes: 'Car accident on I-95, injuries reported.', createdAt: ago(1) },
    { id: 'l3', serviceId: 'sv5', name: 'Elena Petrova', email: 'elena.p@mail.com', phone: '(917) 555-0102', source: 'Website', practiceArea: 'Immigration', status: 'follow_up', value: 4200, assignedTo: 'Priya Nair', notes: 'H-1B to green card process.', createdAt: ago(3), lastContactAt: ago(1) },
    { id: 'l4', serviceId: 'sv8', name: 'Tom Alvarez', email: 'tom@alvarezbuilds.com', phone: '(718) 555-0177', source: 'Referral', practiceArea: 'Business Law', status: 'contacted', value: 12000, assignedTo: 'James Okafor', notes: 'LLC formation and contracts review.', createdAt: ago(4), lastContactAt: ago(2) },
    { id: 'l5', serviceId: 'sv6', name: 'Hannah Lee', email: 'hannah.lee@mail.com', phone: '(212) 555-0166', source: 'Facebook', practiceArea: 'Estate Planning', status: 'consultation', value: 3500, assignedTo: 'Sarah Mitchell', notes: 'Will and living trust. Consultation Thursday 2pm.', createdAt: ago(6), lastContactAt: ago(2) },
    { id: 'l6', serviceId: 'sv7', name: 'Omar Haddad', email: 'omar.h@mail.com', phone: '(347) 555-0123', source: 'Avvo', practiceArea: 'Criminal Defense', status: 'attorney_review', value: 9000, assignedTo: 'David Cohen', notes: 'DUI charge, hearing next month.', createdAt: ago(7), lastContactAt: ago(3) },
    { id: 'l7', serviceId: 'sv10', name: 'Linda Park', email: 'linda.park@mail.com', phone: '(929) 555-0188', source: 'Website', practiceArea: 'Employment', status: 'payment_link_sent', value: 15000, assignedTo: 'Priya Nair', notes: 'Wrongful termination. Engagement signed, retainer payment link sent.', createdAt: ago(10), lastContactAt: ago(2) },
    { id: 'l8', serviceId: 'sv11', name: 'Gary Nolan', email: 'gary.nolan@mail.com', phone: '(631) 555-0150', source: 'Phone', practiceArea: 'Real Estate', status: 'engagement_sent', value: 5200, assignedTo: 'James Okafor', notes: 'Commercial lease dispute.', createdAt: ago(12), lastContactAt: ago(5) },
    { id: 'l9', serviceId: 'sv4', name: 'Sofia Reyes', email: 'sofia.reyes@mail.com', phone: '(917) 555-0111', source: 'Referral', practiceArea: 'Immigration', status: 'retained', value: 5800, assignedTo: 'Priya Nair', notes: 'Family-based visa petition.', createdAt: ago(20), lastContactAt: ago(8), clientId: 'c1' },
    { id: 'l10', serviceId: 'sv3', name: 'Daniel Brooks', email: 'daniel.brooks@mail.com', phone: '(212) 555-0132', source: 'Google Ads', practiceArea: 'Personal Injury', status: 'retained', value: 32000, assignedTo: 'David Cohen', notes: 'Slip and fall, strong liability.', createdAt: ago(30), lastContactAt: ago(14), clientId: 'c2' },
    { id: 'l12', serviceId: 'sv9', name: 'Harbor Logistics LLC', email: 'legal@harborlogistics.com', phone: '(718) 555-0100', source: 'Referral', practiceArea: 'Business Law', status: 'retained', value: 36000, assignedTo: 'James Okafor', notes: 'Ongoing vendor contract work.', createdAt: ago(130), lastContactAt: ago(120), clientId: 'c3' },
    { id: 'l13', serviceId: 'sv6', name: 'Patricia Owens', email: 'p.owens@mail.com', phone: '(212) 555-0155', source: 'Walk-in', practiceArea: 'Estate Planning', status: 'retained', value: 2400, assignedTo: 'Sarah Mitchell', notes: 'Family trust – completed.', createdAt: ago(310), lastContactAt: ago(300), clientId: 'c4' },
    { id: 'l11', serviceId: 'sv1', name: 'Nina Shah', email: 'nina.shah@mail.com', phone: '(646) 555-0170', source: 'Website', practiceArea: 'Family Law', status: 'lost', value: 4000, assignedTo: 'Sarah Mitchell', notes: 'Chose another firm on price.', createdAt: ago(25), lastContactAt: ago(15) },
  ] satisfies Lead[],

  clients: [
    { id: 'c1', name: 'Sofia Reyes', email: 'sofia.reyes@mail.com', phone: '(917) 555-0111', practiceArea: 'Immigration', status: 'active', leadId: 'l9', since: ago(8) },
    { id: 'c2', name: 'Daniel Brooks', email: 'daniel.brooks@mail.com', phone: '(212) 555-0132', practiceArea: 'Personal Injury', status: 'active', leadId: 'l10', since: ago(14) },
    { id: 'c3', name: 'Harbor Logistics LLC', email: 'legal@harborlogistics.com', phone: '(718) 555-0100', company: 'Harbor Logistics LLC', practiceArea: 'Business Law', status: 'active', leadId: 'l12', since: ago(120) },
    { id: 'c4', name: 'Patricia Owens', email: 'p.owens@mail.com', phone: '(212) 555-0155', practiceArea: 'Estate Planning', status: 'closed', leadId: 'l13', since: ago(300) },
  ] satisfies Client[],

  matters: [
    { id: 'm1', clientId: 'c1', title: 'I-130 Family Petition', practiceArea: 'Immigration', status: 'open', attorney: 'Priya Nair', openedAt: ago(8) },
    { id: 'm2', clientId: 'c2', title: 'Brooks v. Metro Mall – Slip & Fall', practiceArea: 'Personal Injury', status: 'open', attorney: 'David Cohen', openedAt: ago(14) },
    { id: 'm3', clientId: 'c3', title: 'Vendor Contract Negotiation', practiceArea: 'Business Law', status: 'pending', attorney: 'James Okafor', openedAt: ago(90) },
    { id: 'm4', clientId: 'c4', title: 'Owens Family Trust', practiceArea: 'Estate Planning', status: 'closed', attorney: 'Sarah Mitchell', openedAt: ago(300) },
  ] satisfies Matter[],

  documents: [
    { id: 'd1', name: 'Retainer Agreement – Sofia Reyes', kind: 'Retainer Agreement', recipientName: 'Sofia Reyes', recipientEmail: 'sofia.reyes@mail.com', clientId: 'c1', status: 'signed', createdAt: ago(10), sentAt: ago(9), signedAt: ago(8) },
    { id: 'd2', name: 'Retainer Agreement – Daniel Brooks', kind: 'Retainer Agreement', recipientName: 'Daniel Brooks', recipientEmail: 'daniel.brooks@mail.com', clientId: 'c2', status: 'signed', createdAt: ago(16), sentAt: ago(15), signedAt: ago(14) },
    { id: 'd3', name: 'Engagement Letter – Linda Park', kind: 'Engagement Letter', recipientName: 'Linda Park', recipientEmail: 'linda.park@mail.com', leadId: 'l7', status: 'signed', createdAt: ago(3), sentAt: ago(2), signedAt: ago(1) },
    { id: 'd4', name: 'Fee Agreement – Gary Nolan', kind: 'Fee Agreement', recipientName: 'Gary Nolan', recipientEmail: 'gary.nolan@mail.com', leadId: 'l8', status: 'sent', createdAt: ago(5), sentAt: ago(5) },
    { id: 'd5', name: 'HIPAA Authorization – Daniel Brooks', kind: 'HIPAA Authorization', recipientName: 'Daniel Brooks', recipientEmail: 'daniel.brooks@mail.com', clientId: 'c2', status: 'draft', createdAt: ago(1) },
    { id: 'd6', name: 'Power of Attorney – Sofia Reyes', kind: 'Power of Attorney', recipientName: 'Sofia Reyes', recipientEmail: 'sofia.reyes@mail.com', clientId: 'c1', status: 'declined', createdAt: ago(7), sentAt: ago(6) },
  ] satisfies LegalDocument[],

  invoices: [
    { id: 'i1', number: 'INV-1001', clientId: 'c1', matterId: 'm1', type: 'retainer', description: 'Initial retainer – I-130 petition', amount: 3000, status: 'paid', dueDate: ahead(-7), paidAt: ago(8), method: 'Card' },
    { id: 'i2', number: 'INV-1002', clientId: 'c2', matterId: 'm2', type: 'retainer', description: 'Retainer deposit – slip & fall', amount: 5000, status: 'paid', dueDate: ahead(-12), paidAt: ago(13), method: 'ACH' },
    { id: 'i3', number: 'INV-1003', clientId: 'c3', matterId: 'm3', type: 'invoice', description: 'October legal services', amount: 4850, status: 'overdue', dueDate: ahead(-9) },
    { id: 'i4', number: 'INV-1004', clientId: 'c3', matterId: 'm3', type: 'invoice', description: 'November legal services', amount: 3200, status: 'sent', dueDate: ahead(12) },
    { id: 'i5', number: 'INV-1005', clientId: 'c2', matterId: 'm2', type: 'invoice', description: 'Expert witness filing fees', amount: 1250, status: 'draft', dueDate: ahead(20) },
    { id: 'i6', number: 'INV-1006', clientId: 'c4', type: 'invoice', description: 'Final trust administration', amount: 2400, status: 'paid', dueDate: ahead(-290), paidAt: ago(292), method: 'Check' },
    { id: 'i7', number: 'INV-1007', leadId: 'l7', type: 'retainer', description: 'Retainer – Wrongful Termination', amount: 3000, status: 'sent', dueDate: ahead(5) },
  ] satisfies Invoice[],

  campaigns: [
    {
      id: 'cp1', name: 'New Lead Nurture', trigger: 'lead_created', status: 'active', createdAt: ago(60),
      steps: [
        { id: 's1', type: 'email', delayDays: 0, subject: 'Thanks for contacting us, {{first_name}}', body: 'We received your inquiry about {{practice_area}} and an attorney will reach out shortly. Book a time here: {{booking_link}}' },
        { id: 's2', type: 'wait', delayDays: 2, subject: '', body: '' },
        { id: 's3', type: 'email', delayDays: 0, subject: 'Still need help with {{practice_area}}?', body: 'Just checking in. Free 15-minute case review available this week.' },
        { id: 's4', type: 'task', delayDays: 3, subject: 'Call lead', body: 'Phone follow-up if no response.' },
      ],
      stats: { enrolled: 142, sent: 318, opened: 211, replied: 48, converted: 21 },
    },
    {
      id: 'cp2', name: 'Consultation Reminder', trigger: 'consultation_booked', status: 'active', createdAt: ago(45),
      steps: [
        { id: 's1', type: 'email', delayDays: 0, subject: 'Your consultation is confirmed', body: 'Here is what to bring to your consultation...' },
        { id: 's2', type: 'sms', delayDays: 1, subject: '', body: 'Reminder: your consultation with {{attorney}} is tomorrow.' },
      ],
      stats: { enrolled: 64, sent: 128, opened: 101, replied: 22, converted: 30 },
    },
    {
      id: 'cp3', name: 'Proposal Follow-up', trigger: 'proposal_sent', status: 'paused', createdAt: ago(30),
      steps: [
        { id: 's1', type: 'wait', delayDays: 3, subject: '', body: '' },
        { id: 's2', type: 'email', delayDays: 0, subject: 'Questions about your engagement letter?', body: 'Happy to walk through any terms before you sign.' },
        { id: 's3', type: 'wait', delayDays: 4, subject: '', body: '' },
        { id: 's4', type: 'email', delayDays: 0, subject: 'Last follow-up on your proposal', body: 'Our offer stands for 7 more days.' },
      ],
      stats: { enrolled: 37, sent: 66, opened: 44, replied: 11, converted: 9 },
    },
    {
      id: 'cp4', name: 'Overdue Invoice Reminders', trigger: 'invoice_overdue', status: 'draft', createdAt: ago(5),
      steps: [{ id: 's1', type: 'email', delayDays: 0, subject: 'Friendly reminder: invoice {{invoice_number}}', body: 'Pay securely online: {{payment_link}}' }],
      stats: { enrolled: 0, sent: 0, opened: 0, replied: 0, converted: 0 },
    },
  ] satisfies Campaign[],

  activities: [
    { id: 'a1', entityType: 'lead', entityId: 'l1', text: 'New lead from Google Ads', at: ago(0) },
    { id: 'a2', entityType: 'lead', entityId: 'l2', text: 'New lead from Referral', at: ago(1) },
    { id: 'a3', entityType: 'document', entityId: 'd3', text: 'Linda Park viewed Engagement Letter', at: ago(1) },
    { id: 'a4', entityType: 'invoice', entityId: 'i3', text: 'INV-1003 is overdue', at: ago(2) },
    { id: 'a5', entityType: 'lead', entityId: 'l5', text: 'Hannah Lee moved to Consultation', at: ago(2) },
    { id: 'a6', entityType: 'client', entityId: 'c1', text: 'Sofia Reyes converted from lead to client', at: ago(8) },
    { id: 'a7', entityType: 'invoice', entityId: 'i1', text: 'INV-1001 paid – $3,000', at: ago(8) },
    { id: 'a8', entityType: 'document', entityId: 'd1', text: 'Sofia Reyes signed Retainer Agreement', at: ago(8) },
  ] satisfies Activity[],
}
