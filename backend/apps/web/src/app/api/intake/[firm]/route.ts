import { handleIntake } from '@mgc/flows';
import { apiDeps } from '@/server/deps';

export const dynamic = 'force-dynamic';

// Firm websites post here from their own domains, so the endpoint allows cross-origin form posts.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Accepts JSON or a plain HTML form post (urlencoded or multipart). */
async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const type = req.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) return (await req.json()) as Record<string, unknown>;
    if (type.includes('form')) {
      const form = await req.formData();
      const out: Record<string, unknown> = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
      if ('smsConsent' in out) out.smsConsent = ['on', 'true', '1', 'yes'].includes(String(out.smsConsent));
      return out;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ firm: string }> }) {
  const { firm } = await ctx.params;
  const body = await readBody(req);
  if (!body) return Response.json({ error: 'unsupported_body' }, { status: 415, headers: CORS });

  const result = await handleIntake(apiDeps(), firm, body, {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
    consentText: typeof body.consentText === 'string' ? body.consentText : undefined,
  });

  if (!result.ok) return Response.json(result, { status: result.status, headers: CORS });
  if (result.status === 202) return Response.json({ ok: true }, { status: 202, headers: CORS });
  return Response.json({ ok: true, leadId: result.leadId }, { status: 201, headers: CORS });
}
