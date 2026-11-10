import { describe, expect, it } from 'vitest';
import { TwentyError, twentyClient } from './index';

function fakeFetch(responses: unknown[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = responses.shift();
    const status = (body as { __status?: number })?.__status ?? 200;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const lookup = async () => ({ baseUrl: 'http://twenty.local/', apiKey: 'key_1' });

describe('twentyClient', () => {
  it('creates a person with split name, email and US phone, using the firm workspace key', async () => {
    const f = fakeFetch([{ data: { createPerson: { id: 'p_1' } } }]);
    const t = twentyClient(lookup, f.impl);
    const out = await t.upsertPerson('firm_1', { name: 'Rachel Anne Greene', email: 'rachel@example.com', phone: '+15552139364' });
    expect(out).toEqual({ id: 'p_1' });
    expect(f.calls[0]!.url).toBe('http://twenty.local/rest/people');
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer key_1');
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({
      name: { firstName: 'Rachel', lastName: 'Anne Greene' },
      emails: { primaryEmail: 'rachel@example.com' },
      phones: { primaryPhoneNumber: '5552139364', primaryPhoneCountryCode: 'US', primaryPhoneCallingCode: '+1' },
    });
  });

  it('maps our stages onto the workspace stage values', async () => {
    const f = fakeFetch([{ data: { createOpportunity: { id: 'o_1' } } }, {}]);
    const t = twentyClient(lookup, f.impl);
    await t.createLead('firm_1', { personId: 'p_1', title: 'Contested divorce', stage: 'new', source: 'web', practiceArea: 'Family law', notes: null });
    await t.setStage('firm_1', 'o_1', 'lost', 'Fee too high');
    expect(JSON.parse(String(f.calls[0]!.init.body))).toMatchObject({ stage: 'NEW', leadSource: 'WEB', pointOfContactId: 'p_1' });
    expect(f.calls[1]!.url).toBe('http://twenty.local/rest/opportunities/o_1');
    expect(JSON.parse(String(f.calls[1]!.init.body))).toEqual({ stage: 'LOST', lostReason: 'Fee too high' });
  });

  it('links a task to its lead', async () => {
    const f = fakeFetch([{ data: { createTask: { id: 't_1' } } }, { data: { createTaskTarget: { id: 'tt_1' } } }]);
    const t = twentyClient(lookup, f.impl);
    await t.createTask('firm_1', { leadId: 'o_1', title: 'Call within the hour', dueAt: new Date('2026-11-10T15:00:00Z') });
    expect(f.calls.map((c) => c.url)).toEqual(['http://twenty.local/rest/tasks', 'http://twenty.local/rest/taskTargets']);
    expect(JSON.parse(String(f.calls[1]!.init.body))).toEqual({ taskId: 't_1', opportunityId: 'o_1' });
  });

  it('surfaces API errors with status and body', async () => {
    const f = fakeFetch([{ __status: 401, error: 'Unauthorized' }]);
    const t = twentyClient(lookup, f.impl);
    await expect(t.upsertPerson('firm_1', { name: 'A', email: 'a@example.com', phone: null })).rejects.toBeInstanceOf(TwentyError);
  });
});
