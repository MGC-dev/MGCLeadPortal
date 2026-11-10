import { safeEqual } from '@mgc/messaging';
import { apiDeps } from '@/server/deps';
import { env } from '@/server/env';

export const dynamic = 'force-dynamic';

/** Documenso document events (sent, opened, signed). Verified by the shared secret it sends in a header. */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get('x-documenso-secret'), env().DOCUMENSO_WEBHOOK_SECRET)) {
    return new Response('invalid secret', { status: 403 });
  }
  const payload = (await req.json().catch(() => null)) as { event?: string; payload?: { id?: number | string } } | null;
  const docId = payload?.payload?.id;
  if (!payload?.event || docId === undefined) return Response.json({ error: 'bad_payload' }, { status: 400 });

  const externalId = `${payload.event}:${docId}`;
  const { repos, queue } = apiDeps();
  if (await repos.webhooks.recordOnce({ source: 'documenso', externalId, firmId: null, signatureOk: true, payload })) {
    await queue.enqueue('esign', 'document.event', { event: payload.event, documensoId: String(docId) }, { jobId: `documenso:${externalId}` });
  }
  return Response.json({ ok: true });
}
