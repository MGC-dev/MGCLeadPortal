/**
 * Interfaces the API and worker depend on. Real implementations live in @mgc/db, @mgc/twenty,
 * @mgc/messaging and @mgc/jobs; in-memory fakes make every flow testable without vendors.
 */
import type { Channel, ChannelStatus } from './consent';
import type { Source, Stage } from './index';

export interface Firm {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
  instantReply: string | null;
}

export interface SendingSetup {
  firmId: string;
  emailDomain: string | null;
  emailStatus: ChannelStatus;
  twilioSubaccountSid: string | null;
  twilioNumber: string | null;
  smsStatus: ChannelStatus;
}

export interface Contact {
  id: string;
  firmId: string;
  name: string;
  email: string | null;
  phone: string | null;
  timeZone: string | null;
  twentyPersonId: string | null;
  twentyOpportunityId: string | null;
  smsOptedOut: boolean;
  emailOptedOut: boolean;
}

export type MessageStatus = 'queued' | 'held' | 'deferred' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'received';

export interface Message {
  id: string;
  firmId: string;
  contactId: string | null;
  channel: Channel;
  direction: 'outbound' | 'inbound';
  status: MessageStatus;
  statusReason: string | null;
  body: string;
  providerId: string | null;
  idempotencyKey: string | null;
  sendAfter: Date | null;
}

export interface Repos {
  firms: {
    bySlug(slug: string): Promise<Firm | null>;
    byId(id: string): Promise<Firm | null>;
    byTwilioNumber(e164: string): Promise<Firm | null>;
  };
  sending: { get(firmId: string): Promise<SendingSetup> };
  contacts: {
    get(id: string): Promise<Contact | null>;
    /** Match by phone first, then email, within one firm. */
    find(firmId: string, by: { phone: string | null; email: string | null }): Promise<Contact | null>;
    create(c: Omit<Contact, 'id' | 'smsOptedOut' | 'emailOptedOut'>): Promise<Contact>;
    update(id: string, patch: Partial<Omit<Contact, 'id' | 'firmId'>>): Promise<Contact>;
  };
  consents: {
    record(c: { firmId: string; contactId: string; channel: Channel; status: 'granted' | 'revoked'; source: string; evidence?: Record<string, unknown> }): Promise<void>;
    /** Latest consent for a channel; null = never asked. */
    latest(contactId: string, channel: Channel): Promise<'granted' | 'revoked' | null>;
  };
  messages: {
    get(id: string): Promise<Message | null>;
    /** Insert unless a message with the same idempotency key exists; returns the stored row and whether it was new. */
    insertOnce(m: Omit<Message, 'id'>): Promise<{ message: Message; created: boolean }>;
    update(id: string, patch: Partial<Pick<Message, 'status' | 'statusReason' | 'providerId' | 'sendAfter'>>): Promise<void>;
  };
  webhooks: {
    /** Store a webhook once; returns false when this (source, externalId) was already seen. */
    recordOnce(e: { source: string; externalId: string; firmId: string | null; signatureOk: boolean; payload: unknown }): Promise<boolean>;
  };
  audit(e: { firmId: string; actor: string | null; action: string; entity: string; entityId?: string; data?: Record<string, unknown> }): Promise<void>;
}

/** The hidden engine. Each firm has its own workspace; the implementation picks it by firmId. */
export interface TwentyPort {
  upsertPerson(firmId: string, p: { name: string; email: string | null; phone: string | null; existingId?: string | null }): Promise<{ id: string }>;
  createLead(firmId: string, l: { personId: string; title: string; stage: Stage; source: Source; practiceArea: string | null; notes: string | null }): Promise<{ id: string }>;
  setStage(firmId: string, leadId: string, stage: Stage, lostReason?: string): Promise<void>;
  createTask(firmId: string, t: { leadId: string; title: string; dueAt: Date }): Promise<{ id: string }>;
}

export interface SmsSender {
  send(m: { from: string; to: string; body: string; subaccountSid: string | null }): Promise<{ providerId: string }>;
}

export interface EmailSender {
  send(m: { from: string; to: string; subject: string; text: string; replyTo?: string }): Promise<{ providerId: string }>;
}

export interface QueuePort {
  enqueue<T extends object>(queue: string, name: string, data: T, opts?: { jobId?: string; delayMs?: number }): Promise<void>;
}
