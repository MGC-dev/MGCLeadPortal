/**
 * Queue names, job payloads and a BullMQ-backed QueuePort shared by the API (producer) and worker (consumer).
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const QUEUES = {
  intake: 'intake',
  messages: 'messages',
  campaigns: 'campaigns',
  esign: 'esign',
  webhooks: 'webhooks',
  onboarding: 'onboarding',
  scheduled: 'scheduled',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface LeadCreatedJob { firmId: string; contactId: string; leadId: string; isNewContact: boolean }
export interface SendMessageJob { messageId: string }
export interface InboundSmsJob { firmId: string; from: string; to: string; body: string; messageSid: string }

/** Retry policy for every job: exponential backoff, kept failures for the ops screen. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
  removeOnFail: false,
};

export function redisConnection(url: string): IORedis {
  // BullMQ needs maxRetriesPerRequest: null for blocking commands.
  return new IORedis(url, { maxRetriesPerRequest: null });
}

/** A QueuePort over BullMQ. A repeated jobId is ignored by BullMQ, which makes enqueueing idempotent. */
export function bullQueues(connection: IORedis) {
  const cache = new Map<string, Queue>();
  const get = (name: string) => {
    let q = cache.get(name);
    if (!q) {
      q = new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
      cache.set(name, q);
    }
    return q;
  };
  return {
    async enqueue<T extends object>(queue: string, name: string, data: T, opts?: { jobId?: string; delayMs?: number }) {
      await get(queue).add(name, data, { ...(opts?.jobId && { jobId: opts.jobId }), ...(opts?.delayMs && { delay: opts.delayMs }) });
    },
    async close() {
      await Promise.all([...cache.values()].map((q) => q.close()));
    },
  };
}
