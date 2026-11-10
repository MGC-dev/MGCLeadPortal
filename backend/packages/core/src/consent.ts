/**
 * Rules every outbound message passes before it is sent.
 * Kept pure (no I/O) so they are easy to test and identical in the API and the worker.
 */

export type Channel = 'email' | 'sms';
export type ChannelStatus = 'not_started' | 'pending' | 'verified' | 'failed';

/** Texts go out only between these local hours: 8:00 to 20:59 in the contact's time zone. */
export const QUIET_HOURS = { startHour: 8, endHour: 21 } as const;

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']);
const START_WORDS = new Set(['START', 'UNSTOP', 'YES']);

/** A reply that opts the contact out of texts. Carriers treat these words as opt-outs. */
export const isStopReply = (body: string): boolean => STOP_WORDS.has(body.trim().toUpperCase().replace(/[^A-Z]/g, ''));
export const isStartReply = (body: string): boolean => START_WORDS.has(body.trim().toUpperCase().replace(/[^A-Z]/g, ''));

/** The local hour (0-23) at `at` in an IANA time zone such as "America/Chicago". */
export function localHour(at: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(at);
  return Number(h);
}

export const withinSendingHours = (at: Date, timeZone: string): boolean => {
  const h = localHour(at, timeZone);
  return h >= QUIET_HOURS.startHour && h < QUIET_HOURS.endHour;
};

/** The next moment (to the minute) when texts are allowed again, or `at` itself if they are now. */
export function nextSendingTime(at: Date, timeZone: string): Date {
  if (withinSendingHours(at, timeZone)) return at;
  const t = new Date(at);
  t.setUTCSeconds(0, 0);
  for (let i = 0; i < 26 * 60; i += 1) {
    t.setUTCMinutes(t.getUTCMinutes() + 1);
    if (withinSendingHours(t, timeZone)) return t;
  }
  return t;
}

export interface SendContext {
  channel: Channel;
  now: Date;
  /** Contact's time zone; falls back to the firm's. */
  timeZone: string;
  /** The firm's setup for this channel (verified domain, registered number). */
  channelStatus: ChannelStatus;
  /** Has the contact agreed to receive this channel? Email to someone who enquired by email counts as agreed. */
  consented: boolean;
  optedOut: boolean;
  /** Replies to someone who just wrote in are transactional, not marketing. */
  kind: 'transactional' | 'marketing';
}

export type SendDecision =
  | { action: 'send' }
  | { action: 'skip'; reason: 'opted_out' | 'no_consent' }
  | { action: 'hold'; reason: 'channel_not_verified' }
  | { action: 'defer'; reason: 'quiet_hours'; until: Date };

/**
 * Decide what to do with one message.
 * Order matters: opt-out always wins; unverified channels hold (never drop); quiet hours defer texts.
 */
export function decideSend(c: SendContext): SendDecision {
  if (c.optedOut) return { action: 'skip', reason: 'opted_out' };
  if (!c.consented && (c.channel === 'sms' || c.kind === 'marketing')) return { action: 'skip', reason: 'no_consent' };
  if (c.channelStatus !== 'verified') return { action: 'hold', reason: 'channel_not_verified' };
  if (c.channel === 'sms' && !withinSendingHours(c.now, c.timeZone)) {
    return { action: 'defer', reason: 'quiet_hours', until: nextSendingTime(c.now, c.timeZone) };
  }
  return { action: 'send' };
}

/** The line every marketing text carries, added only when the body has no opt-out wording yet. */
export function withOptOutLine(body: string): string {
  return /\bSTOP\b/i.test(body) ? body : `${body.trimEnd()} Reply STOP to opt out.`;
}

/** Stable key so a retried job never sends the same message twice. */
export const messageKey = (parts: { scope: string; contactId: string; channel: Channel; ref: string }): string =>
  `msg:${parts.scope}:${parts.ref}:${parts.contactId}:${parts.channel}`;
