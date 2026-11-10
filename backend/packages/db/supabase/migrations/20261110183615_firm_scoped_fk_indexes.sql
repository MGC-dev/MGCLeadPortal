-- Same-firm foreign keys are (x_id, firm_id); index them on both columns.
-- Where a list is shown newest first, the order column rides along so one index serves both.
drop index if exists public.leads_contact_idx;
create index leads_contact_firm_idx on public.leads (contact_id, firm_id);

drop index if exists public.lead_events_lead_idx;
create index lead_events_lead_firm_at_idx on public.lead_events (lead_id, firm_id, at desc);

drop index if exists public.notes_lead_idx;
create index notes_lead_firm_created_idx on public.notes (lead_id, firm_id, created_at desc);

drop index if exists public.tasks_lead_idx;
create index tasks_lead_firm_idx on public.tasks (lead_id, firm_id);

drop index if exists public.documents_lead_idx;
create index documents_lead_firm_idx on public.documents (lead_id, firm_id);
