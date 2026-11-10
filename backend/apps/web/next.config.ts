import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@mgc/core', '@mgc/db', '@mgc/flows', '@mgc/jobs', '@mgc/messaging'],
  serverExternalPackages: ['bullmq', 'ioredis', 'twilio'],
  output: 'standalone',
  // The backend is its own pnpm workspace inside the repo; trace files from here, not the repo root.
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
};
export default config;
