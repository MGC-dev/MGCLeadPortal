/** In-memory implementations of the ports, for tests and for running locally without vendors. */
import type { Channel } from './consent';
import type { Contact, EmailSender, Firm, Message, QueuePort, Repos, SendingSetup, SmsSender, TwentyPort } from './ports';

let seq = 0;
const nextId = (p: string) => `${p}_${(++seq).toString(36)}`;

export interface MemoryStore {
  firms: Firm[];
  sending: SendingSetup[];
  contacts: Contact[];
  consents: { firmId: string; contactId: string; channel: Channel; status: 'granted' | 'revoked'; source: string; at: number }[];
  messages: Message[];
  webhooks: { source: string; externalId: string }[];
  audit: { firmId: string; action: string; entity: string; entityId?: string }[];
}

export function memoryRepos(seed: Partial<MemoryStore> = {}): Repos & { store: MemoryStore } {
  const s: MemoryStore = { firms: [], sending: [], contacts: [], consents: [], messages: [], webhooks: [], audit: [], ...seed };
  return {
    store: s,
    firms: {
      bySlug: async (slug) => s.firms.find((f) => f.slug === slug) ?? null,
      byId: async (id) => s.firms.find((f) => f.id === id) ?? null,
      byTwilioNumber: async (n) => {
        const setup = s.sending.find((x) => x.twilioNumber === n);
        return setup ? s.firms.find((f) => f.id === setup.firmId) ?? null : null;
      },
    },
    sending: {
      get: async (firmId) =>
        s.sending.find((x) => x.firmId === firmId) ?? { firmId, emailDomain: null, emailStatus: 'not_started', twilioSubaccountSid: null, twilioNumber: null, smsStatus: 'not_started' },
    },
    contacts: {
      get: async (id) => s.contacts.find((c) => c.id === id) ?? null,
      find: async (firmId, by) =>
        (by.phone && s.contacts.find((c) => c.firmId === firmId && c.phone === by.phone)) ||
        (by.email && s.contacts.find((c) => c.firmId === firmId && c.email === by.email)) ||
        null,
      create: async (c) => {
        const row: Contact = { ...c, id: nextId('contact'), smsOptedOut: false, emailOptedOut: false };
        s.contacts.push(row);
        return row;
      },
      update: async (id, patch) => {
        const row = s.contacts.find((c) => c.id === id);
        if (!row) throw new Error(`contact ${id} not found`);
        Object.assign(row, patch);
        return row;
      },
    },
    consents: {
      record: async (c) => void s.consents.push({ ...c, at: Date.now() + s.consents.length }),
      latest: async (contactId, channel) =>
        s.consents.filter((c) => c.contactId === contactId && c.channel === channel).sort((a, b) => b.at - a.at)[0]?.status ?? null,
    },
    messages: {
      get: async (id) => s.messages.find((m) => m.id === id) ?? null,
      insertOnce: async (m) => {
        const existing = m.idempotencyKey ? s.messages.find((x) => x.idempotencyKey === m.idempotencyKey) : undefined;
        if (existing) return { message: existing, created: false };
        const row: Message = { ...m, id: nextId('msg') };
        s.messages.push(row);
        return { message: row, created: true };
      },
      update: async (id, patch) => {
        const row = s.messages.find((x) => x.id === id);
        if (row) Object.assign(row, patch);
      },
    },
    webhooks: {
      recordOnce: async (e) => {
        if (s.webhooks.some((w) => w.source === e.source && w.externalId === e.externalId)) return false;
        s.webhooks.push({ source: e.source, externalId: e.externalId });
        return true;
      },
    },
    audit: async (e) => void s.audit.push(e),
  };
}

export function memoryTwenty(): TwentyPort & { people: Map<string, unknown>; leads: Map<string, { stage: string; personId: string; title: string }>; tasks: { leadId: string; title: string; dueAt: Date }[] } {
  const people = new Map<string, unknown>();
  const leads = new Map<string, { stage: string; personId: string; title: string }>();
  const tasks: { leadId: string; title: string; dueAt: Date }[] = [];
  return {
    people, leads, tasks,
    upsertPerson: async (_f, p) => {
      const id = p.existingId ?? nextId('person');
      people.set(id, p);
      return { id };
    },
    createLead: async (_f, l) => {
      const id = nextId('lead');
      leads.set(id, { stage: l.stage, personId: l.personId, title: l.title });
      return { id };
    },
    setStage: async (_f, id, stage) => {
      const l = leads.get(id);
      if (l) l.stage = stage;
    },
    createTask: async (_f, t) => {
      tasks.push(t);
      return { id: nextId('task') };
    },
  };
}

export function memorySms(): SmsSender & { sent: { from: string; to: string; body: string }[] } {
  const sent: { from: string; to: string; body: string }[] = [];
  return { sent, send: async (m) => { sent.push(m); return { providerId: nextId('SM') }; } };
}

export function memoryEmail(): EmailSender & { sent: { to: string; subject: string; text: string }[] } {
  const sent: { to: string; subject: string; text: string }[] = [];
  return { sent, send: async (m) => { sent.push(m); return { providerId: nextId('em') }; } };
}

export function memoryQueue(): QueuePort & { jobs: { queue: string; name: string; data: unknown; jobId?: string; delayMs?: number }[] } {
  const jobs: { queue: string; name: string; data: unknown; jobId?: string; delayMs?: number }[] = [];
  return {
    jobs,
    enqueue: async (queue, name, data, opts) => {
      if (opts?.jobId && jobs.some((j) => j.queue === queue && j.jobId === opts.jobId)) return; // BullMQ ignores duplicate job ids
      jobs.push({ queue, name, data, ...opts });
    },
  };
}
