/**
 * Email (Resend) and text (Twilio) adapters, plus webhook signature checks.
 * Every firm sends from its own verified domain and its own Twilio subaccount and number.
 */
import { Resend } from 'resend';
import twilio from 'twilio';
import type { EmailSender, SmsSender } from '@mgc/core';

export function resendSender(apiKey: string): EmailSender {
  const client = new Resend(apiKey);
  return {
    async send(m) {
      const { data, error } = await client.emails.send({ from: m.from, to: m.to, subject: m.subject, text: m.text, ...(m.replyTo && { replyTo: m.replyTo }) });
      if (error || !data) throw new Error(`Resend send failed: ${error?.message ?? 'no id returned'}`);
      return { providerId: data.id };
    },
  };
}

/**
 * Sends through the firm's Twilio subaccount when it has one, so each firm keeps its own
 * sender reputation and A2P registration. The master credentials own the subaccounts.
 */
export function twilioSender(creds: { accountSid: string; authToken: string; statusCallbackUrl?: string }): SmsSender {
  return {
    async send(m) {
      const client = twilio(creds.accountSid, creds.authToken, m.subaccountSid ? { accountSid: m.subaccountSid } : undefined);
      const msg = await client.messages.create({ from: m.from, to: m.to, body: m.body, ...(creds.statusCallbackUrl && { statusCallback: creds.statusCallbackUrl }) });
      return { providerId: msg.sid };
    },
  };
}

/** Verify Twilio's X-Twilio-Signature header for a form-encoded webhook. */
export function verifyTwilioSignature(authToken: string, signature: string | null, url: string, params: Record<string, string>): boolean {
  if (!signature) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}

/** Constant-time comparison for shared-secret webhooks (Documenso sends its secret in a header). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hex signature check, for signed webhooks from services that use a shared secret. */
export async function verifyHmacSha256(secret: string, payload: string, signatureHex: string | null): Promise<boolean> {
  if (!signatureHex) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
  return safeEqual(hex, signatureHex.toLowerCase());
}
