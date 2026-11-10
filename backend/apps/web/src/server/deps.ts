import 'server-only';
import { serviceClient, supabaseRepos } from '@mgc/db';
import { bullQueues, redisConnection } from '@mgc/jobs';
import type { QueuePort, Repos } from '@mgc/core';
import { env } from './env';

export interface ApiDeps { repos: Repos; queue: QueuePort }

let deps: ApiDeps | null = null;

/** Real services, built once per server process. Tests pass in-memory deps to the flows instead. */
export function apiDeps(): ApiDeps {
  if (!deps) {
    const e = env();
    const db = serviceClient(e);
    deps = {
      repos: supabaseRepos(db),
      queue: bullQueues(redisConnection(e.REDIS_URL)),
    };
  }
  return deps;
}
