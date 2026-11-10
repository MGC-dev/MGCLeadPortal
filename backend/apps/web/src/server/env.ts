import { z } from 'zod';

/** Server configuration, validated once at first use. Missing values fail loudly instead of at the first send. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUBLIC_BASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  REDIS_URL: z.string().url(),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
  TWILIO_AUTH_TOKEN: z.string().min(16),
  DOCUMENSO_WEBHOOK_SECRET: z.string().min(16),
});
export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Invalid server environment: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
