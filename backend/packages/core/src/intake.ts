import { z } from 'zod';

export const SOURCES = ['web', 'email', 'text', 'manual', 'referral', 'ads'] as const;
export type Source = (typeof SOURCES)[number];

/**
 * Normalise a US phone number to E.164 (+1XXXXXXXXXX).
 * Accepts formats like "(555) 013-9364", "555.013.9364", "+1 555 013 9364".
 * Returns null when it is not a 10-digit US number.
 */
export function toE164US(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  // NANP: area code and exchange cannot start with 0 or 1
  if (/^[01]/.test(ten) || /^[01]/.test(ten.slice(3))) return null;
  return `+1${ten}`;
}

export const normaliseEmail = (e: string | undefined | null): string | null => {
  const v = e?.trim().toLowerCase();
  return v ? v : null;
};

/** What a public intake channel (web form, Quick Intake) may send. */
export const IntakeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().trim().email().max(254).optional().or(z.literal('')),
    phone: z.string().trim().max(32).optional().or(z.literal('')),
    matter: z.string().trim().max(200).optional(),
    practiceArea: z.string().trim().max(80).optional(),
    message: z.string().trim().max(5000).optional(),
    source: z.enum(SOURCES).default('web'),
    /** Explicit opt-in to texts, shown next to the phone field. */
    smsConsent: z.boolean().default(false),
    /** Honeypot: real people never fill this hidden field. */
    website: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Give a phone number or an email' });
    if (v.phone && !toE164US(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a 10-digit US phone number' });
    if (v.smsConsent && !v.phone) ctx.addIssue({ code: 'custom', path: ['smsConsent'], message: 'A phone number is needed to agree to texts' });
  });

export type IntakeInput = z.input<typeof IntakeSchema>;
export type Intake = z.output<typeof IntakeSchema>;

export interface NormalisedIntake {
  name: string;
  email: string | null;
  phone: string | null;
  matter: string | null;
  practiceArea: string | null;
  message: string | null;
  source: Source;
  smsConsent: boolean;
  isSpam: boolean;
}

export function normaliseIntake(i: Intake): NormalisedIntake {
  return {
    name: i.name,
    email: normaliseEmail(i.email),
    phone: toE164US(i.phone),
    matter: i.matter || null,
    practiceArea: i.practiceArea || null,
    message: i.message || null,
    source: i.source,
    smsConsent: i.smsConsent,
    isSpam: Boolean(i.website && i.website.trim()),
  };
}
