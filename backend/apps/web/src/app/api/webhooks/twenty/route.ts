import { verifyHmacSha256 } from '@mgc/messaging';
import { apiDeps } from '@/server/deps';
import { env } from '@/server/env';

export const dynamic = 'force-dynamic';

/**
 * Record changes inside Twenty (for example a stage moved by automation). These become worker jobs
 * that fire campaign triggers. The signature header and signing string must match the Twenty
 * version we deploy; confirm against its webhook docs during setup.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const timestamp = req.headers.get('x-twenty-webhook-timestamp') ?? '';
  const signed = timestamp ? `${timestamp}:${raw}` : raw;
  if (!(await verifyHmacSha256(env().TWENTY_WEBHOOK_SECRET, signed, req.headers.get('x-twenty-webhook-signature')))) {
    return new Response('invalid signature', { status: 403 });
  }
  const payload = JSON.parse(raw) as { eventName?: string; record?: { id?: string }; workspaceId?: string };
  const externalId = `${payload.eventName ?? 'event'}:${payload.record?.id ?? 'unknown'}:${timestamp || raw.length}`;
  const { repos, queue } = apiDeps();
  if (await repos.webhooks.recordOnce({ source: 'twenty', externalId, firmId: null, signatureOk: true, payload })) {
    await queue.enqueue('webhooks', 'twenty.event', payload, { jobId: `twenty:${externalId}` });
  }
  return Response.json({ ok: true });
}
