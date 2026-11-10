/**
 * Worker job handlers. Each one is idempotent: safe to run twice after a crash or retry.
 */
import {
  DEFAULT_INSTANT_REPLY, decideSend, fillTemplate, isStartReply, isStopReply, messageKey,
  type QueuePort, type Repos, type SmsSender,
} from '@mgc/core';

export interface WorkerDeps { repos: Repos; sms: SmsSender; queue: QueuePort; now?: () => Date }

const decisionLabel = (s: string) => (s === 'queued' ? 'send' : s === 'deferred' ? 'defer' : s === 'held' ? 'hold' : 'skip') as 'send' | 'defer' | 'hold' | 'skip';

/** A new lead: book the first call, then send the instant text reply if every rule allows it. */
export async function onLeadCreated(deps: WorkerDeps, job: { firmId: string; contactId: string; leadId: string }) {
  const now = deps.now?.() ?? new Date();
  const [firm, contact, setup] = await Promise.all([
    deps.repos.firms.byId(job.firmId),
    deps.repos.contacts.get(job.contactId),
    deps.repos.sending.get(job.firmId),
  ]);
  if (!firm || !contact) throw new Error(`lead.created: missing firm or contact for ${job.leadId}`);

  // Speed to lead: the first call is due within the hour. Booked once, when this job first runs.
  const bookCall = () => deps.repos.tasks.create({ firmId: firm.id, leadId: job.leadId, title: `Call ${contact.name} within the hour`, dueAt: new Date(now.getTime() + 3600_000) });

  if (!contact.phone) {
    await bookCall();
    return { reply: 'no_phone' as const };
  }

  const consent = await deps.repos.consents.latest(contact.id, 'sms');
  const body = fillTemplate(firm.instantReply ?? DEFAULT_INSTANT_REPLY, { name: contact.name, firm: firm.name });
  const decision = decideSend({
    channel: 'sms', now, timeZone: contact.timeZone ?? firm.timeZone, channelStatus: setup.smsStatus,
    consented: consent === 'granted', optedOut: contact.smsOptedOut || consent === 'revoked', kind: 'transactional',
  });

  const key = messageKey({ scope: 'instant-reply', ref: job.leadId, contactId: contact.id, channel: 'sms' });
  const status = decision.action === 'send' ? 'queued' : decision.action === 'defer' ? 'deferred' : decision.action === 'hold' ? 'held' : 'skipped';
  const { message, created } = await deps.repos.messages.insertOnce({
    firmId: firm.id, contactId: contact.id, channel: 'sms', direction: 'outbound', status,
    statusReason: decision.action === 'send' ? null : decision.reason, body, providerId: null, idempotencyKey: key,
    sendAfter: decision.action === 'defer' ? decision.until : null,
  });
  if (message.providerId) return { reply: 'already_sent' as const };
  if (created) await bookCall();

  // On a retry, re-enqueue from the stored row: the job id makes this a no-op if the first attempt queued it.
  const stored = decisionLabel(message.status);
  if (stored === 'send') await deps.queue.enqueue('messages', 'send', { messageId: message.id }, { jobId: `send:${message.id}` });
  if (stored === 'defer' && message.sendAfter) {
    await deps.queue.enqueue('messages', 'send', { messageId: message.id }, { jobId: `send:${message.id}`, delayMs: Math.max(0, message.sendAfter.getTime() - now.getTime()) });
  }
  return { reply: stored };
}

/** Send one stored outbound text. Re-checks opt-out at send time, since it may have changed while queued. */
export async function onSendSms(deps: WorkerDeps, job: { messageId: string }) {
  const m = await deps.repos.messages.get(job.messageId);
  if (!m || m.channel !== 'sms') return { sent: false, reason: 'not_found' as const };
  if (m.providerId) return { sent: false, reason: 'already_sent' as const };
  const contact = m.contactId ? await deps.repos.contacts.get(m.contactId) : null;
  const setup = await deps.repos.sending.get(m.firmId);
  if (!contact?.phone || contact.smsOptedOut) {
    await deps.repos.messages.update(m.id, { status: 'skipped', statusReason: 'opted_out' });
    return { sent: false, reason: 'opted_out' as const };
  }
  if (setup.smsStatus !== 'verified' || !setup.twilioNumber) {
    await deps.repos.messages.update(m.id, { status: 'held', statusReason: 'channel_not_verified' });
    return { sent: false, reason: 'held' as const };
  }
  const { providerId } = await deps.sms.send({ from: setup.twilioNumber, to: contact.phone, body: m.body, subaccountSid: setup.twilioSubaccountSid });
  await deps.repos.messages.update(m.id, { status: 'sent', providerId });
  return { sent: true, providerId };
}

/** An inbound text: STOP opts out at once; START opts back in; anything else is logged as a reply. */
export async function onInboundSms(deps: WorkerDeps, job: { firmId: string; from: string; body: string; messageSid: string }) {
  const contact = await deps.repos.contacts.find(job.firmId, { phone: job.from, email: null });
  await deps.repos.messages.insertOnce({
    firmId: job.firmId, contactId: contact?.id ?? null, channel: 'sms', direction: 'inbound', status: 'received',
    statusReason: null, body: job.body, providerId: job.messageSid, idempotencyKey: `in:${job.messageSid}`, sendAfter: null,
  });
  if (!contact) return { action: 'unknown_sender' as const };
  if (isStopReply(job.body)) {
    await deps.repos.contacts.update(contact.id, { smsOptedOut: true });
    await deps.repos.consents.record({ firmId: job.firmId, contactId: contact.id, channel: 'sms', status: 'revoked', source: 'STOP reply', evidence: { messageSid: job.messageSid } });
    return { action: 'opted_out' as const };
  }
  if (isStartReply(job.body) && contact.smsOptedOut) {
    await deps.repos.contacts.update(contact.id, { smsOptedOut: false });
    await deps.repos.consents.record({ firmId: job.firmId, contactId: contact.id, channel: 'sms', status: 'granted', source: 'START reply', evidence: { messageSid: job.messageSid } });
    return { action: 'opted_in' as const };
  }
  return { action: 'reply_logged' as const };
}
