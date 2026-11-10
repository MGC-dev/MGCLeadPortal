import { describe, expect, it } from 'vitest';
import {
  IntakeSchema, canMove, decideSend, fillTemplate, isStopReply, localHour, messageKey,
  nextSendingTime, normaliseIntake, toE164US, withOptOutLine,
} from './index';

describe('toE164US', () => {
  it.each([
    ['(555) 213-9364', '+15552139364'],
    ['555.213.9364', '+15552139364'],
    ['+1 555 213 9364', '+15552139364'],
    ['15552139364', '+15552139364'],
  ])('normalises %s', (input, out) => expect(toE164US(input)).toBe(out));

  it.each(['555-0134', '(055) 213-9364', '(555) 113-9364', '', null])('rejects %s', (input) => expect(toE164US(input)).toBeNull());
});

describe('IntakeSchema', () => {
  it('needs a phone or an email', () => {
    expect(IntakeSchema.safeParse({ name: 'Rachel Greene' }).success).toBe(false);
    expect(IntakeSchema.safeParse({ name: 'Rachel Greene', email: 'rachel@example.com' }).success).toBe(true);
  });
  it('needs a phone to agree to texts', () => {
    expect(IntakeSchema.safeParse({ name: 'A', email: 'a@example.com', smsConsent: true }).success).toBe(false);
  });
  it('normalises and flags the honeypot', () => {
    const p = IntakeSchema.parse({ name: ' Rachel ', email: 'Rachel@Example.com', phone: '(555) 213-9364', website: 'spam.biz' });
    expect(normaliseIntake(p)).toMatchObject({ name: 'Rachel', email: 'rachel@example.com', phone: '+15552139364', source: 'web', isSpam: true });
  });
});

describe('stages', () => {
  it('lets open leads move or be lost, reopens lost, never moves delivered', () => {
    expect(canMove('new', 'consult')).toBe(true);
    expect(canMove('contract', 'lost')).toBe(true);
    expect(canMove('lost', 'new')).toBe(true);
    expect(canMove('lost', 'signed')).toBe(false);
    expect(canMove('delivered', 'lost')).toBe(false);
  });
});

describe('sending rules', () => {
  const NY = 'America/New_York';
  // 2026-11-10 14:00 UTC = 09:00 in New York
  const morning = new Date('2026-11-10T14:00:00Z');
  // 2026-11-11 03:00 UTC = 22:00 in New York
  const night = new Date('2026-11-11T03:00:00Z');
  const base = { channel: 'sms' as const, timeZone: NY, channelStatus: 'verified' as const, consented: true, optedOut: false, kind: 'transactional' as const };

  it('reads local hours', () => {
    expect(localHour(morning, NY)).toBe(9);
    expect(localHour(night, NY)).toBe(22);
  });
  it('sends in hours', () => expect(decideSend({ ...base, now: morning })).toEqual({ action: 'send' }));
  it('defers texts at night until 8 AM local', () => {
    const d = decideSend({ ...base, now: night });
    expect(d.action).toBe('defer');
    if (d.action === 'defer') expect(d.until.toISOString()).toBe('2026-11-11T13:00:00.000Z');
    expect(nextSendingTime(night, NY).toISOString()).toBe('2026-11-11T13:00:00.000Z');
  });
  it('opt-out always wins', () => expect(decideSend({ ...base, now: morning, optedOut: true })).toEqual({ action: 'skip', reason: 'opted_out' }));
  it('never texts without consent', () => expect(decideSend({ ...base, now: morning, consented: false })).toEqual({ action: 'skip', reason: 'no_consent' }));
  it('holds (does not drop) when the channel is not verified', () =>
    expect(decideSend({ ...base, now: morning, channelStatus: 'pending' })).toEqual({ action: 'hold', reason: 'channel_not_verified' }));
  it('ignores quiet hours for email', () => expect(decideSend({ ...base, channel: 'email', now: night })).toEqual({ action: 'send' }));
  it('recognises STOP replies', () => {
    expect(isStopReply(' stop ')).toBe(true);
    expect(isStopReply('Unsubscribe.')).toBe(true);
    expect(isStopReply('please stop by tomorrow')).toBe(false);
  });
  it('adds the opt-out line once', () => {
    expect(withOptOutLine('Hi Rachel.')).toBe('Hi Rachel. Reply STOP to opt out.');
    expect(withOptOutLine('Reply STOP to end.')).toBe('Reply STOP to end.');
  });
  it('builds stable idempotency keys', () =>
    expect(messageKey({ scope: 'intake', ref: 'lead_1', contactId: 'c_1', channel: 'sms' })).toBe('msg:intake:lead_1:c_1:sms'));
});

describe('templates', () => {
  it('fills merge fields', () =>
    expect(fillTemplate('Hi {first}, about your {matter}. {firm}', { name: 'Rachel Greene', matter: 'Custody Question', firm: 'Example Family Law LLP' }))
      .toBe('Hi Rachel, about your custody question. Example Family Law LLP'));
});
