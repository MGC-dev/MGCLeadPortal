/**
 * MGC CRM worker: consumes the BullMQ queues on Redis. Runs as its own service so slow vendors
 * never hold up the API, and every job retries with backoff.
 */
import { Worker, type Job } from 'bullmq';
import { z } from 'zod';
import { serviceClient, supabaseRepos } from '@mgc/db';
import { onInboundSms, onLeadCreated, onSendSms, type WorkerDeps } from '@mgc/flows';
import { QUEUES, bullQueues, redisConnection, type InboundSmsJob, type LeadCreatedJob, type SendMessageJob } from '@mgc/jobs';
import { twilioSender } from '@mgc/messaging';

const env = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  REDIS_URL: z.string().url(),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
  TWILIO_AUTH_TOKEN: z.string().min(16),
  PUBLIC_BASE_URL: z.string().url(),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
}).parse(process.env);

const log = (level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) =>
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra }));

const connection = redisConnection(env.REDIS_URL);
const db = serviceClient(env);
const deps: WorkerDeps = {
  repos: supabaseRepos(db),
  sms: twilioSender({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN }),
  queue: bullQueues(connection),
};

type Handler = (job: Job) => Promise<unknown>;
const handlers: Record<string, Record<string, Handler>> = {
  [QUEUES.intake]: {
    'lead.created': (j) => onLeadCreated(deps, j.data as LeadCreatedJob),
  },
  [QUEUES.messages]: {
    send: (j) => onSendSms(deps, j.data as SendMessageJob),
  },
  [QUEUES.webhooks]: {
    'sms.inbound': (j) => onInboundSms(deps, j.data as InboundSmsJob),
  },
  [QUEUES.esign]: {
    // Documenso events: stage updates and signed-PDF storage land in the Contracts workstream.
    'document.event': async (j) => log('info', 'documenso event received', { jobId: j.id }),
  },
};

const workers = Object.entries(handlers).map(([queue, byName]) => {
  const w = new Worker(queue, async (job) => {
    const handler = byName[job.name];
    if (!handler) throw new Error(`No handler for ${queue}/${job.name}`);
    const result = await handler(job);
    log('info', 'job done', { queue, name: job.name, jobId: job.id, result });
    return result;
  }, { connection, concurrency: env.WORKER_CONCURRENCY });
  w.on('failed', (job, err) => log('error', 'job failed', { queue, name: job?.name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message }));
  return w;
});

log('info', 'worker started', { queues: Object.keys(handlers), concurrency: env.WORKER_CONCURRENCY });

async function shutdown(signal: string) {
  log('info', 'worker stopping', { signal });
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
