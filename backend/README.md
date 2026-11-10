# MGC CRM backend

The API and worker behind MGC CRM, following the architecture doc: a Next.js API, a Node.js worker on BullMQ,
and Supabase as the single source of truth for firms, contacts, leads and their stage history, tasks, notes,
custom fields, consent, messages and audit. Firm staff never reach the vendors directly; only this backend does.

## Layout

```
backend/
├─ apps/
│  ├─ web/        Next.js API (and later the product UI). Route handlers under src/app/api
│  └─ worker/     BullMQ worker: instant replies, sends, inbound texts, webhook follow-up
├─ packages/
│  ├─ core/       Domain rules: stages, lost reasons, intake validation, consent and quiet hours,
│  │              shared interfaces (ports) and in-memory fakes for tests
│  ├─ flows/      Business flows used by the API and worker (intake, instant reply, send, STOP)
│  ├─ db/         Supabase migrations, RLS tests, typed client, secret encryption
│  ├─ messaging/  Resend and Twilio adapters, webhook signature checks
│  ├─ jobs/       Queue names, job payloads, BullMQ producer
│  └─ config/     Shared TypeScript settings
└─ infra/docker/  Local Redis
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Uptime and load balancer check |
| POST | `/api/intake/:firmSlug` | Web form / Quick Intake. JSON or a plain HTML form post, CORS-enabled |
| POST | `/api/webhooks/twilio` | Inbound texts (STOP, START, replies). Twilio-signed |
| POST | `/api/webhooks/documenso` | Signing events. Shared-secret header |

Intake fields: `name` (required), `email` and/or `phone` (US), `matter`, `practiceArea`, `message`, `source`,
`smsConsent` (the text opt-in checkbox), `consentText` (the wording shown), and a hidden `website` honeypot.

## Rules enforced in code

- Lead stages follow the pipeline: Lost needs a reason, Delivered is final, a lost lead can only reopen as New;
  every change is written to `lead_events` by a database trigger, so history can't be skipped.
- One firm never sees another's data: Supabase row-level security on every table, tested in `packages/db/supabase/sql-tests`.
- Texts only to people who opted in; STOP opts out at once; quiet hours 8 AM–9 PM in the contact's time zone.
- Nothing is dropped while a firm's domain or number is unverified: messages are held and sent once verified.
- Every job is idempotent: a retry never sends twice or books the first call twice.
- Webhooks are verified, stored once, acknowledged fast and processed in the queue.

## Supabase

Project **MGC-02-LeadPortal** (`fzpzyftefquczmcydmzz`, us-east-1). All four migrations in
`packages/db/supabase/migrations` are applied (17 tables, row-level security on each); Supabase's security and performance checks are clean
apart from expected notices (server-only tables have no client policies; new indexes are unused until data arrives).

After any schema change: add a migration file, run `pnpm --filter @mgc/db test:sql`, apply it, then
`pnpm --filter @mgc/db gen:types`.

## Running locally

Needs Node 22+, pnpm 10, Docker.

```bash
cd backend
pnpm install
pnpm stack:up                         # Redis
pnpm --filter @mgc/db db:start        # local Supabase; prints the URL and service key
cp .env.example apps/web/.env.local   # fill in values
cp .env.example apps/worker/.env
pnpm dev                              # API on http://localhost:3001 and the worker
```

Try an enquiry once a firm row exists (slug `example-family-law`):

```bash
curl -X POST http://localhost:3001/api/intake/example-family-law \
  -H 'content-type: application/json' \
  -d '{"name":"Rachel Greene","phone":"(555) 213-9364","matter":"Contested divorce","smsConsent":true}'
```

## Checks

```bash
pnpm typecheck                        # every package
pnpm test                             # unit and flow tests (no vendors needed)
DATABASE_URL=postgres://... pnpm --filter @mgc/db test:sql   # migrations + RLS on a throwaway database
pnpm build
```

CI runs all four on every pull request that touches `backend/` (`.github/workflows/backend-ci.yml`).

## Not built yet

- Firm sign-up and invites, sending-setup flows (Resend domains, Twilio subaccounts and A2P), and the product UI on top of leads, tasks, notes and custom fields
- Campaign triggers and one-off sends, Documenso send and signed-PDF storage, email intake
- Rate limiting on the public intake endpoint, AWS infrastructure as code
