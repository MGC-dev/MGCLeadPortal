/**
 * Lead intake: one flow for every channel (web form, inbound email, inbound text, Quick Intake).
 * The API route stays thin; this is where the rules live, so they are tested without HTTP or vendors.
 */
import { IntakeSchema, normaliseIntake, type QueuePort, type Repos } from '@mgc/core';

export interface IntakeDeps { repos: Repos; queue: QueuePort }

export type IntakeResult =
  | { ok: true; status: 201; leadId: string; contactId: string; duplicate: boolean }
  | { ok: true; status: 202; ignored: 'spam' }
  | { ok: false; status: 404; error: 'firm_not_found' }
  | { ok: false; status: 422; error: 'invalid'; issues: { path: string; message: string }[] };

export async function handleIntake(
  deps: IntakeDeps,
  firmSlug: string,
  body: unknown,
  meta: { ip?: string | null; userAgent?: string | null; consentText?: string } = {},
): Promise<IntakeResult> {
  const firm = await deps.repos.firms.bySlug(firmSlug);
  if (!firm) return { ok: false, status: 404, error: 'firm_not_found' };

  const parsed = IntakeSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 422, error: 'invalid', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  }
  const lead = normaliseIntake(parsed.data);
  // Accept spam quietly so bots learn nothing, but create nothing.
  if (lead.isSpam) return { ok: true, status: 202, ignored: 'spam' };

  // De-duplicate within the firm: same phone, then same email. A returning person gets a new lead on the same contact.
  const existing = await deps.repos.contacts.find(firm.id, { phone: lead.phone, email: lead.email });
  const contact = existing
    ? await deps.repos.contacts.update(existing.id, {
        name: lead.name,
        ...(lead.email && !existing.email && { email: lead.email }),
        ...(lead.phone && !existing.phone && { phone: lead.phone }),
      })
    : await deps.repos.contacts.create({ firmId: firm.id, name: lead.name, email: lead.email, phone: lead.phone, timeZone: null });

  const created = await deps.repos.leads.create({
    firmId: firm.id, contactId: contact.id, title: lead.matter ?? lead.practiceArea ?? 'New enquiry',
    source: lead.source, practiceArea: lead.practiceArea, intakeMessage: lead.message,
  });

  if (lead.smsConsent && lead.phone) {
    await deps.repos.consents.record({
      firmId: firm.id, contactId: contact.id, channel: 'sms', status: 'granted', source: `${lead.source} form`,
      evidence: { ip: meta.ip ?? null, userAgent: meta.userAgent ?? null, wording: meta.consentText ?? null, at: new Date().toISOString() },
    });
  }

  await deps.repos.audit({ firmId: firm.id, actor: null, action: 'lead.created', entity: 'lead', entityId: created.id, data: { source: lead.source, duplicate: Boolean(existing) } });

  // The worker sends the instant reply, books the first call and fires campaign triggers.
  await deps.queue.enqueue('intake', 'lead.created', { firmId: firm.id, contactId: contact.id, leadId: created.id, isNewContact: !existing }, { jobId: `lead.created:${created.id}` });

  return { ok: true, status: 201, leadId: created.id, contactId: contact.id, duplicate: Boolean(existing) };
}
