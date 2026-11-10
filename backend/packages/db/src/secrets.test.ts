import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secrets';

describe('secrets', () => {
  const key = randomBytes(32).toString('base64');
  it('round-trips and never repeats ciphertext', () => {
    const a = encryptSecret(key, 'twilio_subaccount_token_123');
    const b = encryptSecret(key, 'twilio_subaccount_token_123');
    expect(a).not.toBe(b);
    expect(decryptSecret(key, a)).toBe('twilio_subaccount_token_123');
  });
  it('rejects tampering and wrong keys', () => {
    const sealed = encryptSecret(key, 'secret');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(key, parts.join('.'))).toThrow();
    expect(() => decryptSecret(randomBytes(32).toString('base64'), sealed)).toThrow();
  });
  it('requires a 32-byte key', () => expect(() => encryptSecret('c2hvcnQ=', 'x')).toThrow(/32 bytes/));
});
