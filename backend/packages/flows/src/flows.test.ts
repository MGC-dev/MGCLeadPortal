import { beforeEach, describe, expect, it } from 'vitest';
import { memoryQueue, memoryRepos, memorySms, type SendingSetup } from '@mgc/core';
import { handleIntake, onInboundSms, onLeadCreated, onSendSms } from './index';

const FIRM = { id: 'firm_1', name: 'Example Family Law LLP', slug: 'example-family-law', timeZone: 'America/New_York', instantReply: null };
const LIVE: SendingSetup = { firmId: 'firm_1', emailDomain: 'examplefamilylaw.com', emailStatus: 'verified', twilioSubaccountSid: 'AC_sub', twilioNumber: '+15552130001', smsStatus: 'verified' };
// 09:00 in New York
const MORNING = new Date('2026-11-10T14:00:00Z');
// 22:00 in New York
const NIGHT = new Date('2026-11-11T03:00:00Z');

function setup(sending: SendingSetup = LIVE) {
  const repos = memoryRepos({ firms: [FIRM], sending: [sending] });
  const queue = memoryQueue();
  const sms = memorySms();
  return { repos, queue, sms };
}

const FORM = { name: 'Rachel Greene', phone: '(555) 213-9364', email: 'rachel@example.com', matter: 'Contested divorce', practiceArea: 'Family law', smsConsent: true };

describe('handleIntake', () => {
  let d: ReturnType<typeof setup>;
  beforeEach(() => { d = setup(); });

  it('creates the contact, the lead with its history, the consent, and queues follow-up once', async () => {
    const r = await handleIntake(d, 'example-family-law', FORM, { ip: '203.0.113.7', consentText: 'I agree to receive texts.' });
    expect(r).toMatchObject({ ok: true, status: 201, duplicate: false });
    expect(d.repos.store.leads).toHaveLength(1);
    expect(d.repos.store.leads[0]).toMatchObject({ stage: 'new', title: 'Contested divorce', source: 'web', practiceArea: 'Family law', firmId: 'firm_1' });
    expect(d.repos.store.leadEvents).toEqual([expect.objectContaining({ kind: 'created', to: 'new' })]);
    expect(d.repos.store.contacts).toHaveLength(1);
    expect(d.repos.store.contacts[0]).toMatchObject({ phone: '+15552139364', email: 'rachel@example.com' });
    expect(d.repos.store.consents).toEqual([expect.objectContaining({ channel: 'sms', status: 'granted', source: 'web form' })]);
    expect(d.queue.jobs).toEqual([expect.objectContaining({ queue: 'intake', name: 'lead.created' })]);
  });

  it('matches a returning person by phone and opens a new lead on the same contact', async () => {
    await handleIntake(d, 'example-family-law', FORM);
    const r = await handleIntake(d, 'example-family-law', { name: 'Rachel Greene', phone: '555.213.9364', matter: 'Child support' });
    expect(r).toMatchObject({ ok: true, duplicate: true });
    expect(d.repos.store.contacts).toHaveLength(1);
    expect(d.repos.store.leads).toHaveLength(2);
    expect(new Set(d.repos.store.leads.map((l) => l.contactId)).size).toBe(1);
  });

  it('rejects unknown firms and invalid input with field messages', async () => {
    expect(await handleIntake(d, 'nobody', FORM)).toMatchObject({ ok: false, status: 404 });
    const bad = await handleIntake(d, 'example-family-law', { name: '', phone: '123' });
    expect(bad).toMatchObject({ ok: false, status: 422 });
    if (!bad.ok && bad.status === 422) expect(bad.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['name', 'phone']));
  });

  it('quietly drops honeypot spam without creating anything', async () => {
    expect(await handleIntake(d, 'example-family-law', { ...FORM, website: 'cheap-seo.biz' })).toMatchObject({ status: 202, ignored: 'spam' });
    expect(d.repos.store.leads).toHaveLength(0);
    expect(d.queue.jobs).toHaveLength(0);
  });

  it('does not record text consent unless the box was ticked', async () => {
    await handleIntake(d, 'example-family-law', { ...FORM, smsConsent: false });
    expect(d.repos.store.consents).toHaveLength(0);
  });
});

describe('onLeadCreated', () => {
  async function intake(d: ReturnType<typeof setup>, form = FORM) {
    const r = await handleIntake(d, 'example-family-law', form);
    if (!r.ok || r.status !== 201) throw new Error('intake failed');
    return { firmId: FIRM.id, contactId: r.contactId, leadId: r.leadId };
  }

  it('books the first call and queues the instant reply in sending hours', async () => {
    const d = setup();
    const job = await intake(d);
    const out = await onLeadCreated({ ...d, now: () => MORNING }, job);
    expect(out).toEqual({ reply: 'send' });
    expect(d.repos.store.tasks[0]).toMatchObject({ title: 'Call Rachel Greene within the hour', leadId: job.leadId, status: 'open' });
    expect(d.repos.store.tasks[0]!.dueAt?.toISOString()).toBe('2026-11-10T15:00:00.000Z');
    const msg = d.repos.store.messages[0]!;
    expect(msg).toMatchObject({ status: 'queued', channel: 'sms' });
    expect(msg.body).toBe('Hi Rachel, thanks for contacting Example Family Law LLP. We have your message and someone from our team will call you shortly.');
    expect(d.queue.jobs.at(-1)).toMatchObject({ queue: 'messages', name: 'send' });
  });

  it('defers the reply to 8 AM when a lead arrives at night', async () => {
    const d = setup();
    const job = await intake(d);
    expect(await onLeadCreated({ ...d, now: () => NIGHT }, job)).toEqual({ reply: 'defer' });
    expect(d.repos.store.messages[0]).toMatchObject({ status: 'deferred', statusReason: 'quiet_hours' });
    expect(d.queue.jobs.at(-1)!.delayMs).toBe(10 * 3600_000);
  });

  it('holds the reply (never drops it) until the firm’s texting number is registered', async () => {
    const d = setup({ ...LIVE, smsStatus: 'pending' });
    const job = await intake(d);
    expect(await onLeadCreated({ ...d, now: () => MORNING }, job)).toEqual({ reply: 'hold' });
    expect(d.repos.store.messages[0]).toMatchObject({ status: 'held' });
  });

  it('never texts someone who did not agree to texts', async () => {
    const d = setup();
    const job = await intake(d, { ...FORM, smsConsent: false });
    expect(await onLeadCreated({ ...d, now: () => MORNING }, job)).toEqual({ reply: 'skip' });
  });

  it('is safe to run twice: one message, one send job', async () => {
    const d = setup();
    const job = await intake(d);
    await onLeadCreated({ ...d, now: () => MORNING }, job);
    await onLeadCreated({ ...d, now: () => MORNING }, job);
    expect(d.repos.store.messages).toHaveLength(1);
    expect(d.queue.jobs.filter((j) => j.queue === 'messages')).toHaveLength(1);
    expect(d.repos.store.tasks).toHaveLength(1);
  });
});

describe('lead stages', () => {
  it('moves a lead forward, requires a reason for lost, and only reopens a lost lead as new', async () => {
    const d = setup();
    const r = await handleIntake(d, 'example-family-law', FORM);
    if (!r.ok || r.status !== 201) throw new Error('intake failed');
    const leads = d.repos.leads;
    expect((await leads.setStage(r.leadId, 'contacted')).stage).toBe('contacted');
    await expect(leads.setStage(r.leadId, 'lost')).rejects.toThrow();
    expect(await leads.setStage(r.leadId, 'lost', 'Went with another firm')).toMatchObject({ stage: 'lost', lostReason: 'Went with another firm' });
    await expect(leads.setStage(r.leadId, 'consult')).rejects.toThrow();
    expect((await leads.setStage(r.leadId, 'new')).stage).toBe('new');
    expect(d.repos.store.leadEvents.map((e) => e.to)).toEqual(['new', 'contacted', 'lost', 'new']);
  });
});

describe('onSendSms and STOP', () => {
  it('sends from the firm’s own number and subaccount, then honours STOP for later sends', async () => {
    const d = setup();
    const r = await handleIntake(d, 'example-family-law', FORM);
    if (!r.ok || r.status !== 201) throw new Error('intake failed');
    await onLeadCreated({ ...d, now: () => MORNING }, { firmId: FIRM.id, contactId: r.contactId, leadId: r.leadId });
    const messageId = d.repos.store.messages[0]!.id;

    expect(await onSendSms(d, { messageId })).toMatchObject({ sent: true });
    expect(d.sms.sent[0]).toMatchObject({ from: '+15552130001', to: '+15552139364' });
    expect(await onSendSms(d, { messageId })).toEqual({ sent: false, reason: 'already_sent' });

    expect(await onInboundSms(d, { firmId: FIRM.id, from: '+15552139364', body: 'Stop', messageSid: 'SM_in_1' })).toEqual({ action: 'opted_out' });
    expect(d.repos.store.contacts[0]!.smsOptedOut).toBe(true);
    expect(d.repos.store.consents.at(-1)).toMatchObject({ status: 'revoked', source: 'STOP reply' });

    // A later lead from the same person: the reply is skipped because they opted out.
    const again = await handleIntake(d, 'example-family-law', { ...FORM, smsConsent: false, matter: 'Custody' });
    if (!again.ok || again.status !== 201) throw new Error('intake failed');
    expect(await onLeadCreated({ ...d, now: () => MORNING }, { firmId: FIRM.id, contactId: again.contactId, leadId: again.leadId })).toEqual({ reply: 'skip' });
  });
});
