/** Fill {first}, {matter} and {firm} in a message body. Unknown fields are left as written. */
export function fillTemplate(body: string, v: { name?: string | null; matter?: string | null; firm?: string | null }): string {
  const first = (v.name ?? '').trim().split(/\s+/)[0] || 'there';
  return body
    .replace(/\{first\}/g, first)
    .replace(/\{matter\}/g, (v.matter ?? 'your enquiry').toLowerCase())
    .replace(/\{firm\}/g, v.firm ?? '');
}

/** The instant text reply sent when a new enquiry arrives. Firms can change it in Settings. */
export const DEFAULT_INSTANT_REPLY =
  'Hi {first}, thanks for contacting {firm}. We have your message and someone from our team will call you shortly.';
