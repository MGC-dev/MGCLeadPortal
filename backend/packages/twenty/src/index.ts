/**
 * Typed client for Twenty's REST API. Twenty runs unmodified and hidden; only our backend calls it.
 * Each firm has its own workspace, so every call resolves that firm's base URL and API key first.
 *
 * Mapping (configured per workspace during provisioning):
 *   our lead      -> Twenty `opportunity`, our stages -> its `stage` select (NEW, CONTACTED, CONSULT, ...)
 *   our person    -> Twenty `person`
 *   our task      -> Twenty `task` + `taskTarget` linking it to the opportunity
 */
import type { Stage, TwentyPort } from '@mgc/core';

export interface WorkspaceCredentials { baseUrl: string; apiKey: string }
export type CredentialLookup = (firmId: string) => Promise<WorkspaceCredentials>;

export const TWENTY_STAGE: Record<Stage, string> = {
  new: 'NEW', contacted: 'CONTACTED', consult: 'CONSULT', contract: 'CONTRACT', signed: 'SIGNED', delivered: 'DELIVERED', lost: 'LOST',
};

export class TwentyError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) { super(message); }
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** Twenty wraps created records as { data: { createPerson: {...} } }; take the first record with an id. */
function recordId(body: unknown): string {
  const data = (body as { data?: Record<string, { id?: string }> })?.data;
  const rec = data && Object.values(data).find((v) => v && typeof v === 'object' && typeof v.id === 'string');
  if (!rec?.id) throw new TwentyError('Twenty response had no record id', 200, body);
  return rec.id;
}

export function twentyClient(lookup: CredentialLookup, fetchImpl: typeof fetch = fetch): TwentyPort {
  async function call(firmId: string, method: 'POST' | 'PATCH', path: string, body: unknown): Promise<unknown> {
    const { baseUrl, apiKey } = await lookup(firmId);
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/rest/${path}`, {
      method,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new TwentyError(`Twenty ${method} ${path} failed with ${res.status}`, res.status, json);
    return json;
  }

  return {
    async upsertPerson(firmId, p) {
      const body = {
        name: splitName(p.name),
        ...(p.email && { emails: { primaryEmail: p.email } }),
        ...(p.phone && { phones: { primaryPhoneNumber: p.phone.replace(/^\+1/, ''), primaryPhoneCountryCode: 'US', primaryPhoneCallingCode: '+1' } }),
      };
      if (p.existingId) {
        await call(firmId, 'PATCH', `people/${p.existingId}`, body);
        return { id: p.existingId };
      }
      return { id: recordId(await call(firmId, 'POST', 'people', body)) };
    },
    async createLead(firmId, l) {
      const body = {
        name: l.title,
        stage: TWENTY_STAGE[l.stage],
        pointOfContactId: l.personId,
        // Custom fields created at provisioning time:
        leadSource: l.source.toUpperCase(),
        ...(l.practiceArea && { practiceArea: l.practiceArea }),
        ...(l.notes && { intakeNotes: l.notes }),
      };
      return { id: recordId(await call(firmId, 'POST', 'opportunities', body)) };
    },
    async setStage(firmId, leadId, stage, lostReason) {
      await call(firmId, 'PATCH', `opportunities/${leadId}`, { stage: TWENTY_STAGE[stage], ...(lostReason && { lostReason }) });
    },
    async createTask(firmId, t) {
      const taskId = recordId(await call(firmId, 'POST', 'tasks', { title: t.title, dueAt: t.dueAt.toISOString(), status: 'TODO' }));
      await call(firmId, 'POST', 'taskTargets', { taskId, opportunityId: t.leadId });
      return { id: taskId };
    },
  };
}
