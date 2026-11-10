/**
 * AES-256-GCM encryption for per-firm secrets stored in the database (for example, Twenty API keys).
 * The key comes from APP_ENCRYPTION_KEY (32 bytes, base64) held in AWS Secrets Manager, never in the database.
 * Format: v1.<iv>.<tag>.<ciphertext>, each part base64url.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const b64 = (b: Buffer) => b.toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url');

function keyFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

export function encryptSecret(base64Key: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(base64Key), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', b64(iv), b64(cipher.getAuthTag()), b64(ct)].join('.');
}

export function decryptSecret(base64Key: string, sealed: string): string {
  const [v, iv, tag, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognised secret format');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(base64Key), unb64(iv));
  decipher.setAuthTag(unb64(tag));
  return Buffer.concat([decipher.update(unb64(ct)), decipher.final()]).toString('utf8');
}
