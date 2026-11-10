-- Leads move into Supabase; Twenty is removed.
-- Adds leads with an automatic stage history, tasks, notes and per-firm custom fields,
-- and drops everything that pointed at Twenty.

-- ---------- types ----------
create type lead_stage as enum ('new', 'contacted', 'consult', 'contract', 'signed', 'delivered', 'lost');
create type task_status as enum ('open', 'done', 'cancelled');
create type custom_field_type as enum ('text', 'number', 'date', 'select', 'boolean');

-- ---------- remove Twenty ----------
drop table if exists public.firm_twenty;
alter table public.contacts drop column if exists twenty_person_id;
alter table public.contacts drop column if exists twenty_opportunity_id;
alter table public.documents drop column if exists twenty_opportunity_id;

-- Lets child tables prove a row belongs to the same firm (no cross-firm links, even by mistake).
alter table public.contacts add constraint contacts_id_firm_key unique (id, firm_id);

-- ---------- leads ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  contact_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  stage lead_stage not null default 'new',
  source text not null check (source in ('web', 'email', 'text', 'manual', 'referral', 'ads')),
  practice_area text,
  value_cents bigint not null default 0 check (value_cents >= 0),
  owner_id uuid references auth.users (id) on delete set null,
  intake_message text,
  lost_reason text,
  custom jsonb not null default '{}' check (jsonb_typeof(custom) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, firm_id),
  foreign key (contact_id, firm_id) references public.contacts (id, firm_id) on delete cascade,
  check (stage <> 'lost' or lost_reason is not null)
);
create index leads_firm_stage_idx on public.leads (firm_id, stage);
create index leads_firm_created_idx on public.leads (firm_id, created_at desc);
create index leads_contact_idx on public.leads (contact_id);
create index leads_owner_idx on public.leads (owner_id);

-- Append-only history: every creation and stage change is written by trigger, so reports can trust it.
create table public.lead_events (
  id bigint generated always as identity primary key,
  firm_id uuid not null,
  lead_id uuid not null,
  actor uuid,                                  -- null = system
  kind text not null,                          -- 'created' | 'stage_changed' | 'assigned' | 'call_logged' | ...
  from_stage lead_stage,
  to_stage lead_stage,
  data jsonb not null default '{}',
  at timestamptz not null default now(),
  foreign key (lead_id, firm_id) references public.leads (id, firm_id) on delete cascade
);
create index lead_events_lead_idx on public.lead_events (lead_id, at desc);
create index lead_events_firm_at_idx on public.lead_events (firm_id, at desc);

-- ---------- tasks and notes ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  lead_id uuid,
  title text not null check (length(title) between 1 and 200),
  due_at timestamptz,
  status task_status not null default 'open',
  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lead_id, firm_id) references public.leads (id, firm_id) on delete cascade
);
create index tasks_firm_open_idx on public.tasks (firm_id, status, due_at);
create index tasks_lead_idx on public.tasks (lead_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_created_by_idx on public.tasks (created_by);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  lead_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  foreign key (lead_id, firm_id) references public.leads (id, firm_id) on delete cascade
);
create index notes_lead_idx on public.notes (lead_id, created_at desc);
create index notes_firm_idx on public.notes (firm_id);
create index notes_author_idx on public.notes (author_id);

-- ---------- custom fields ----------
-- A firm defines its own fields (e.g. "Date of incident"); each lead stores values in leads.custom by key.
create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (length(label) between 1 and 80),
  type custom_field_type not null,
  options text[] not null default '{}',
  required boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (firm_id, key),
  check (type <> 'select' or cardinality(options) > 0)
);

-- ---------- documents link to leads ----------
alter table public.documents add column lead_id uuid;
alter table public.documents add constraint documents_lead_fkey foreign key (lead_id, firm_id) references public.leads (id, firm_id) on delete set null (lead_id);
create index documents_lead_idx on public.documents (lead_id);

-- ---------- stage rules and history ----------
-- Mirrors canMove() in @mgc/core: Services Provided is final; a lost lead can only be reopened as new.
create or replace function private.lead_stage_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.stage is distinct from old.stage then
    if old.stage = 'delivered' then
      raise exception 'A lead marked Services Provided cannot change stage' using errcode = 'check_violation';
    end if;
    if old.stage = 'lost' and new.stage <> 'new' then
      raise exception 'A lost lead can only be reopened as a new enquiry' using errcode = 'check_violation';
    end if;
    new.stage_changed_at := now();
    new.closed_at := case when new.stage in ('delivered', 'lost') then now() else null end;
    if new.stage <> 'lost' then new.lost_reason := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- security definer: history is written even though clients cannot insert into lead_events.
create or replace function private.lead_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (firm_id, lead_id, actor, kind, to_stage, data)
    values (new.firm_id, new.id, (select auth.uid()), 'created', new.stage, jsonb_build_object('source', new.source));
  elsif new.stage is distinct from old.stage then
    insert into public.lead_events (firm_id, lead_id, actor, kind, from_stage, to_stage, data)
    values (new.firm_id, new.id, (select auth.uid()), 'stage_changed', old.stage, new.stage,
            case when new.stage = 'lost' then jsonb_build_object('reason', new.lost_reason) else '{}'::jsonb end);
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    insert into public.lead_events (firm_id, lead_id, actor, kind, data)
    values (new.firm_id, new.id, (select auth.uid()), 'assigned', jsonb_build_object('from', old.owner_id, 'to', new.owner_id));
  end if;
  return null;
end $$;

create trigger leads_stage_guard before update on public.leads for each row execute function private.lead_stage_guard();
create trigger leads_history after insert or update on public.leads for each row execute function private.lead_history();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- ---------- row-level security ----------
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.custom_field_definitions enable row level security;

create policy leads_read on public.leads for select to authenticated using (private.is_member(firm_id));
create policy leads_insert on public.leads for insert to authenticated with check (private.can_edit(firm_id));
create policy leads_update on public.leads for update to authenticated using (private.can_edit(firm_id)) with check (private.can_edit(firm_id));
create policy leads_delete on public.leads for delete to authenticated using (private.is_admin(firm_id));

-- History is read-only for clients; the trigger and the backend write it.
create policy lead_events_read on public.lead_events for select to authenticated using (private.is_member(firm_id));

create policy tasks_read on public.tasks for select to authenticated using (private.is_member(firm_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (private.can_edit(firm_id));
create policy tasks_update on public.tasks for update to authenticated using (private.can_edit(firm_id)) with check (private.can_edit(firm_id));
create policy tasks_delete on public.tasks for delete to authenticated using (private.can_edit(firm_id));

create policy notes_read on public.notes for select to authenticated using (private.is_member(firm_id));
create policy notes_insert on public.notes for insert to authenticated
  with check (private.can_edit(firm_id) and author_id = (select auth.uid()));
create policy notes_update on public.notes for update to authenticated
  using (author_id = (select auth.uid()) and private.can_edit(firm_id)) with check (author_id = (select auth.uid()));
create policy notes_delete on public.notes for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin(firm_id));

create policy fields_read on public.custom_field_definitions for select to authenticated using (private.is_member(firm_id));
create policy fields_insert on public.custom_field_definitions for insert to authenticated with check (private.is_admin(firm_id));
create policy fields_update on public.custom_field_definitions for update to authenticated using (private.is_admin(firm_id)) with check (private.is_admin(firm_id));
create policy fields_delete on public.custom_field_definitions for delete to authenticated using (private.is_admin(firm_id));

revoke all on all functions in schema private from public;
grant execute on function private.app_role(uuid), private.is_member(uuid), private.can_edit(uuid), private.is_admin(uuid) to authenticated;
