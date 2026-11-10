import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { safeEqual, verifyHmacSha256, verifyTwilioSignature } from './index';

describe('webhook signatures', () => {
  it('accepts a correct Twilio signature and rejects a tampered one', () => {
    const token = 'test_auth_token';
    const url = 'https://api.example.com/api/webhooks/twilio';
    const params = { Body: 'STOP', From: '+15552139364', To: '+15552130001', MessageSid: 'SM123' };
    // Twilio's scheme: base64(HMAC-SHA1(token, url + sorted key/value pairs))
    const data = url + Object.keys(params).sort().map((k) => k + params[k as keyof typeof params]).join('');
    const sig = createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
    expect(verifyTwilioSignature(token, sig, url, params)).toBe(true);
    expect(verifyTwilioSignature(token, sig, url, { ...params, Body: 'START' })).toBe(false);
    expect(verifyTwilioSignature(token, null, url, params)).toBe(false);
  });

  it('checks HMAC-SHA256 signatures', async () => {
    const body = '{"event":"opportunity.updated"}';
    const sig = createHmac('sha256', 'shh').update(body).digest('hex');
    expect(await verifyHmacSha256('shh', body, sig)).toBe(true);
    expect(await verifyHmacSha256('shh', body + ' ', sig)).toBe(false);
  });

  it('compares secrets safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual(null, 'abc')).toBe(false);
  });
});
