export const dynamic = 'force-dynamic';

/** Load balancer and uptime check. Cheap on purpose: no database or vendor calls. */
export function GET() {
  return Response.json({ ok: true, service: 'mgc-crm-api', time: new Date().toISOString() });
}
