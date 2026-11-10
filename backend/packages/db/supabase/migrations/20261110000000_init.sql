-- MGC CRM: initial schema (Supabase / PostgreSQL).
-- Twenty holds the lead record, pipeline stage and custom fields.
-- This database holds firms, people, sending setup, contacts used for messaging, consent,
-- campaigns, the message log, documents, raw webhooks and the audit log.
-- Every firm-owned table carries firm_id and is protected by row-level security.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Permission helpers live outside the public API schema.
create schema if not exists private;

-- ---------- enums ----------
create type member_role as enum ('admin', 'member', 'read_only');
create type setup_status as enum ('not_started', 'pending', 'verified', 'failed');
create type channel as enum ('email', 'sms');
create type consent_status as enum ('granted', 'revoked');
create type campaign_kind as enum ('automatic', 'one_off');
create type message_direction as enum ('outbound', 'inbound');
create type message_status as enum ('queued', 'held', 'deferred', 'sent', 'delivered', 'failed', 'skipped', 'received');
create type document_status as enum ('draft', 'sent', 'viewed', 'signed', 'declined', 'expired');

-- ---------- firms and people ----------
create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  time_zone text not null default 'America/New_York',
  postal_address text,                       -- required in campaign emails (CAN-SPAM)
  instant_reply text,                        -- null = default text
  created_at timestamptz not null default now()
);

create table firm_members (
  firm_id uuid not null references firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'member',
  display_name text,
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);
create index firm_members_user_idx on firm_members (user_id);

create table firm_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  email extensions.citext not null,
  role member_role not null default 'member',
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Server-only: the firm's Twenty workspace and its API key. No client policies.
create table firm_twenty (
  firm_id uuid primary key references firms (id) on delete cascade,
  base_url text not null,
  workspace_id text not null,
  api_key_encrypted text not null,
  created_at timestamptz not null default now()
);

-- Each firm sends from its own domain and number; campaigns unlock per channel when verified.
create table sending_setup (
  firm_id uuid primary key references firms (id) on delete cascade,
  email_domain text,
  email_status setup_status not null default 'not_started',
  resend_domain_id text,
  twilio_subaccount_sid text,
  twilio_number text,
  sms_status setup_status not null default 'not_started',  -- A2P 10DLC registration
  updated_at timestamptz not null default now()
);

-- ---------- contacts and consent ----------
-- A messaging view of a person; the full lead lives in Twenty (twenty_person_id).
create table contacts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  twenty_person_id text,
  twenty_opportunity_id text,
  name text not null,
  email extensions.citext,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+1[2-9][0-9]{9}$'),
  time_zone text,
  sms_opted_out boolean not null default false,
  email_opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone_e164 is not null)
);
create unique index contacts_firm_phone_key on contacts (firm_id, phone_e164) where phone_e164 is not null;
create unique index contacts_firm_email_key on contacts (firm_id, email) where email is not null;

-- Append-only consent history: what was agreed, where, and when.
create table consents (
  id bigint generated always as identity primary key,
  firm_id uuid not null references firms (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  channel channel not null,
  status consent_status not null,
  source text not null,                       -- e.g. 'web form', 'STOP reply', 'staff'
  evidence jsonb not null default '{}',       -- form wording, IP, user agent, message SID
  captured_at timestamptz not null default now()
);
create index consents_contact_idx on consents (contact_id, channel, captured_at desc);

-- ---------- campaigns and messages ----------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  name text not null,
  kind campaign_kind not null,
  trigger text,                               -- automatic campaigns, e.g. 'lead.lost'
  audience text,                              -- one-off sends, e.g. 'open', 'clients'
  channels channel[] not null,
  subject text,
  body text not null,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check ((kind = 'automatic' and trigger is not null) or (kind = 'one_off' and audience is not null))
);

create table campaign_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  recipients int not null default 0
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  campaign_run_id uuid references campaign_runs (id) on delete set null,
  channel channel not null,
  direction message_direction not null,
  status message_status not null,
  status_reason text,
  body text not null,
  subject text,
  provider_id text,                           -- Twilio SID or Resend id
  idempotency_key text unique,                -- a retried job never sends twice
  send_after timestamptz,                     -- quiet hours
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_firm_created_idx on messages (firm_id, created_at desc);
create index messages_provider_idx on messages (provider_id) where provider_id is not null;

-- ---------- documents ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  twenty_opportunity_id text,
  documenso_id text unique,
  title text not null,
  status document_status not null default 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  storage_path text,                          -- signed PDF in S3
  created_at timestamptz not null default now()
);

-- ---------- server-only tables ----------
create table webhook_events (
  id bigint generated always as identity primary key,
  source text not null,                       -- 'twilio' | 'resend' | 'documenso' | 'twenty'
  external_id text not null,
  firm_id uuid references firms (id) on delete set null,
  signature_ok boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (source, external_id)
);

create table audit_log (
  id bigint generated always as identity primary key,
  firm_id uuid not null references firms (id) on delete cascade,
  actor uuid,                                 -- null = system
  action text not null,                       -- e.g. 'lead.stage_changed'
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  at timestamptz not null default now()
);
create index audit_log_firm_at_idx on audit_log (firm_id, at desc);

-- ---------- access helpers ----------
-- security definer so policies can read firm_members without recursing through its own policies.
create or replace function private.app_role(f uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.firm_members m where m.firm_id = f and m.user_id = (select auth.uid())
$$;
create or replace function private.is_member(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select private.app_role(f) is not null $$;
create or replace function private.can_edit(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select private.app_role(f) in ('admin', 'member') $$;
create or replace function private.is_admin(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select private.app_role(f) = 'admin' $$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------- row-level security ----------
alter table firms enable row level security;
alter table firm_members enable row level security;
alter table firm_invites enable row level security;
alter table firm_twenty enable row level security;
alter table sending_setup enable row level security;
alter table contacts enable row level security;
alter table consents enable row level security;
alter table campaigns enable row level security;
alter table campaign_runs enable row level security;
alter table messages enable row level security;
alter table documents enable row level security;
alter table webhook_events enable row level security;
alter table audit_log enable row level security;
-- firm_twenty and webhook_events have no policies: only the service role (our backend) reads them.

create policy firms_read on firms for select to authenticated using (private.is_member(id));
create policy firms_update on firms for update to authenticated using (private.is_admin(id)) with check (private.is_admin(id));

create policy members_read on firm_members for select to authenticated using (private.is_member(firm_id));
create policy members_admin on firm_members for all to authenticated using (private.is_admin(firm_id)) with check (private.is_admin(firm_id));

create policy invites_admin on firm_invites for all to authenticated using (private.is_admin(firm_id)) with check (private.is_admin(firm_id));

create policy setup_read on sending_setup for select to authenticated using (private.is_member(firm_id));
-- sending setup changes go through the backend (it talks to Resend and Twilio), so no client writes.

create policy contacts_read on contacts for select to authenticated using (private.is_member(firm_id));
create policy contacts_write on contacts for insert to authenticated with check (private.can_edit(firm_id));
create policy contacts_update on contacts for update to authenticated using (private.can_edit(firm_id)) with check (private.can_edit(firm_id));

create policy consents_read on consents for select to authenticated using (private.is_member(firm_id));
create policy consents_insert on consents for insert to authenticated with check (private.can_edit(firm_id));
-- consent history is append-only: no update or delete policies.

create policy campaigns_read on campaigns for select to authenticated using (private.is_member(firm_id));
create policy campaigns_write on campaigns for all to authenticated using (private.can_edit(firm_id)) with check (private.can_edit(firm_id));

create policy runs_read on campaign_runs for select to authenticated using (private.is_member(firm_id));
create policy messages_read on messages for select to authenticated using (private.is_member(firm_id));
create policy documents_read on documents for select to authenticated using (private.is_member(firm_id));
create policy audit_read on audit_log for select to authenticated using (private.is_admin(firm_id));

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger contacts_touch before update on contacts for each row execute function touch_updated_at();
create trigger messages_touch before update on messages for each row execute function touch_updated_at();
create trigger setup_touch before update on sending_setup for each row execute function touch_updated_at();
