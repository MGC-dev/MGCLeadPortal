import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Contact, Firm, Lead, Message, Repos, SendingSetup, Source, Task } from '@mgc/core';
import type { Database } from './database.types';

export type { Database } from './database.types';
export { encryptSecret, decryptSecret } from './secrets';
export type Db = SupabaseClient<Database>;

/**
 * Server-only client with the service role key. It bypasses row-level security,
 * so it must only run in our API and worker, never in the browser.
 */
export function serviceClient(env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

const toFirm = (r: Row<'firms'>): Firm => ({ id: r.id, name: r.name, slug: r.slug, timeZone: r.time_zone, instantReply: r.instant_reply });
const toContact = (r: Row<'contacts'>): Contact => ({
  id: r.id, firmId: r.firm_id, name: r.name, email: r.email, phone: r.phone_e164, timeZone: r.time_zone,
  smsOptedOut: r.sms_opted_out, emailOptedOut: r.email_opted_out,
});
const toLead = (r: Row<'leads'>): Lead => ({
  id: r.id, firmId: r.firm_id, contactId: r.contact_id, title: r.title, stage: r.stage, source: r.source as Source,
  practiceArea: r.practice_area, valueCents: r.value_cents, ownerId: r.owner_id, intakeMessage: r.intake_message,
  lostReason: r.lost_reason, custom: (r.custom ?? {}) as Record<string, unknown>, createdAt: new Date(r.created_at),
});
const toTask = (r: Row<'tasks'>): Task => ({
  id: r.id, firmId: r.firm_id, leadId: r.lead_id, title: r.title, dueAt: r.due_at ? new Date(r.due_at) : null, status: r.status, assigneeId: r.assignee_id,
});
const toMessage = (r: Row<'messages'>): Message => ({
  id: r.id, firmId: r.firm_id, contactId: r.contact_id, channel: r.channel, direction: r.direction, status: r.status,
  statusReason: r.status_reason, body: r.body, providerId: r.provider_id, idempotencyKey: r.idempotency_key,
  sendAfter: r.send_after ? new Date(r.send_after) : null,
});

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what}: no row`);
  return res.data as NonNullable<T>;
}

/** Repos backed by Supabase. Every query is scoped to a firm by the caller. */
export function supabaseRepos(db: Db): Repos {
  return {
    firms: {
      bySlug: async (slug) => {
        const { data, error } = await db.from('firms').select('*').eq('slug', slug).maybeSingle();
        if (error) throw new Error(`firm by slug: ${error.message}`);
        return data ? toFirm(data) : null;
      },
      byId: async (id) => {
        const { data, error } = await db.from('firms').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(`firm by id: ${error.message}`);
        return data ? toFirm(data) : null;
      },
      byTwilioNumber: async (n) => {
        const { data, error } = await db.from('sending_setup').select('firm_id').eq('twilio_number', n).maybeSingle();
        if (error) throw new Error(`firm by number: ${error.message}`);
        if (!data) return null;
        const f = await db.from('firms').select('*').eq('id', data.firm_id).maybeSingle();
        return f.data ? toFirm(f.data) : null;
      },
    },
    sending: {
      get: async (firmId): Promise<SendingSetup> => {
        const { data, error } = await db.from('sending_setup').select('*').eq('firm_id', firmId).maybeSingle();
        if (error) throw new Error(`sending setup: ${error.message}`);
        return {
          firmId,
          emailDomain: data?.email_domain ?? null,
          emailStatus: data?.email_status ?? 'not_started',
          twilioSubaccountSid: data?.twilio_subaccount_sid ?? null,
          twilioNumber: data?.twilio_number ?? null,
          smsStatus: data?.sms_status ?? 'not_started',
        };
      },
    },
    contacts: {
      get: async (id) => {
        const { data, error } = await db.from('contacts').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(`contact: ${error.message}`);
        return data ? toContact(data) : null;
      },
      find: async (firmId, by) => {
        for (const [col, val] of [['phone_e164', by.phone], ['email', by.email]] as const) {
          if (!val) continue;
          const { data, error } = await db.from('contacts').select('*').eq('firm_id', firmId).eq(col, val).maybeSingle();
          if (error) throw new Error(`find contact: ${error.message}`);
          if (data) return toContact(data);
        }
        return null;
      },
      create: async (c) =>
        toContact(must(await db.from('contacts').insert({
          firm_id: c.firmId, name: c.name, email: c.email, phone_e164: c.phone, time_zone: c.timeZone,
        }).select('*').single(), 'create contact')),
      update: async (id, p) =>
        toContact(must(await db.from('contacts').update({
          ...(p.name !== undefined && { name: p.name }),
          ...(p.email !== undefined && { email: p.email }),
          ...(p.phone !== undefined && { phone_e164: p.phone }),
          ...(p.timeZone !== undefined && { time_zone: p.timeZone }),
          ...(p.smsOptedOut !== undefined && { sms_opted_out: p.smsOptedOut }),
          ...(p.emailOptedOut !== undefined && { email_opted_out: p.emailOptedOut }),
        }).eq('id', id).select('*').single(), 'update contact')),
    },
    leads: {
      get: async (id) => {
        const { data, error } = await db.from('leads').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(`lead: ${error.message}`);
        return data ? toLead(data) : null;
      },
      // The database writes the 'created' history event and enforces the same-firm contact link.
      create: async (l) =>
        toLead(must(await db.from('leads').insert({
          firm_id: l.firmId, contact_id: l.contactId, title: l.title, source: l.source, practice_area: l.practiceArea,
          intake_message: l.intakeMessage, value_cents: l.valueCents ?? 0, owner_id: l.ownerId ?? null,
        }).select('*').single(), 'create lead')),
      // Stage rules (final stages, lost needs a reason) are enforced by the leads_stage_guard trigger.
      setStage: async (id, stage, lostReason) =>
        toLead(must(await db.from('leads').update({ stage, lost_reason: stage === 'lost' ? lostReason ?? null : null }).eq('id', id).select('*').single(), 'set stage')),
    },
    tasks: {
      create: async (t) =>
        toTask(must(await db.from('tasks').insert({
          firm_id: t.firmId, lead_id: t.leadId, title: t.title, due_at: t.dueAt?.toISOString() ?? null, assignee_id: t.assigneeId ?? null,
        }).select('*').single(), 'create task')),
      openForLead: async (leadId) => {
        const { data, error } = await db.from('tasks').select('*').eq('lead_id', leadId).eq('status', 'open').order('due_at', { ascending: true, nullsFirst: false });
        if (error) throw new Error(`open tasks: ${error.message}`);
        return (data ?? []).map(toTask);
      },
    },
    consents: {
      record: async (c) => {
        const { error } = await db.from('consents').insert({
          firm_id: c.firmId, contact_id: c.contactId, channel: c.channel, status: c.status, source: c.source,
          evidence: (c.evidence ?? {}) as never,
        });
        if (error) throw new Error(`record consent: ${error.message}`);
      },
      latest: async (contactId, channel) => {
        const { data, error } = await db.from('consents').select('status').eq('contact_id', contactId).eq('channel', channel)
          .order('captured_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw new Error(`latest consent: ${error.message}`);
        return data?.status ?? null;
      },
    },
    messages: {
      get: async (id) => {
        const { data, error } = await db.from('messages').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(`message: ${error.message}`);
        return data ? toMessage(data) : null;
      },
      insertOnce: async (m) => {
        const row = {
          firm_id: m.firmId, contact_id: m.contactId, channel: m.channel, direction: m.direction, status: m.status,
          status_reason: m.statusReason, body: m.body, provider_id: m.providerId, idempotency_key: m.idempotencyKey,
          send_after: m.sendAfter?.toISOString() ?? null,
        };
        const ins = await db.from('messages').insert(row).select('*').single();
        if (!ins.error) return { message: toMessage(ins.data), created: true };
        // 23505 = unique violation on idempotency_key: this message was already recorded by an earlier attempt.
        if (ins.error.code === '23505' && m.idempotencyKey) {
          const existing = must(await db.from('messages').select('*').eq('idempotency_key', m.idempotencyKey).single(), 'existing message');
          return { message: toMessage(existing), created: false };
        }
        throw new Error(`insert message: ${ins.error.message}`);
      },
      update: async (id, p) => {
        const { error } = await db.from('messages').update({
          ...(p.status !== undefined && { status: p.status }),
          ...(p.statusReason !== undefined && { status_reason: p.statusReason }),
          ...(p.providerId !== undefined && { provider_id: p.providerId }),
          ...(p.sendAfter !== undefined && { send_after: p.sendAfter?.toISOString() ?? null }),
        }).eq('id', id);
        if (error) throw new Error(`update message: ${error.message}`);
      },
    },
    webhooks: {
      recordOnce: async (e) => {
        const { error } = await db.from('webhook_events').insert({
          source: e.source, external_id: e.externalId, firm_id: e.firmId, signature_ok: e.signatureOk, payload: e.payload as never,
        });
        if (!error) return true;
        if (error.code === '23505') return false;
        throw new Error(`record webhook: ${error.message}`);
      },
    },
    audit: async (e) => {
      const { error } = await db.from('audit_log').insert({
        firm_id: e.firmId, actor: e.actor, action: e.action, entity: e.entity, entity_id: e.entityId ?? null, data: (e.data ?? {}) as never,
      });
      if (error) throw new Error(`audit: ${error.message}`);
    },
  };
}
