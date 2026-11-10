import { verifyTwilioSignature } from '@mgc/messaging';
import { apiDeps } from '@/server/deps';
import { env } from '@/server/env';

export const dynamic = 'force-dynamic';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = (status = 200) => new Response(EMPTY_TWIML, { status, headers: { 'content-type': 'text/xml' } });

/**
 * Inbound texts to any firm's number. Verify, store once, hand to the worker, answer fast.
 * Twilio retries on slow or failed responses, so all the work happens in the queue.
 */
export async function POST(req: Request) {
  const e = env();
  const params = Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]));
  const url = `${e.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/webhooks/twilio`;
  const ok = verifyTwilioSignature(e.TWILIO_AUTH_TOKEN, req.headers.get('x-twilio-signature'), url, params);
  if (!ok) return new Response('invalid signature', { status: 403 });

  const { MessageSid: sid, From: from, To: to, Body: body = '' } = params;
  if (!sid || !from || !to) return twiml(400);

  const { repos, queue } = apiDeps();
  const firm = await repos.firms.byTwilioNumber(to);
  const fresh = await repos.webhooks.recordOnce({ source: 'twilio', externalId: sid, firmId: firm?.id ?? null, signatureOk: true, payload: params });
  if (fresh && firm) {
    await queue.enqueue('webhooks', 'sms.inbound', { firmId: firm.id, from, to, body, messageSid: sid }, { jobId: `sms.inbound:${sid}` });
  }
  return twiml();
}
