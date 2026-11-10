import 'server-only';
import { serviceClient, supabaseRepos, twentyCredentials } from '@mgc/db';
import { bullQueues, redisConnection } from '@mgc/jobs';
import { twentyClient } from '@mgc/twenty';
import type { QueuePort, Repos, TwentyPort } from '@mgc/core';
import { env } from './env';

export interface ApiDeps { repos: Repos; twenty: TwentyPort; queue: QueuePort }

let deps: ApiDeps | null = null;

/** Real services, built once per server process. Tests pass in-memory deps to the flows instead. */
export function apiDeps(): ApiDeps {
  if (!deps) {
    const e = env();
    const db = serviceClient(e);
    deps = {
      repos: supabaseRepos(db),
      twenty: twentyClient(twentyCredentials(db, e.APP_ENCRYPTION_KEY)),
      queue: bullQueues(redisConnection(e.REDIS_URL)),
    };
  }
  return deps;
}
