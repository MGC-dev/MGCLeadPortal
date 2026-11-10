-- Supabase performance advisor follow-up to the initial schema.

-- 1. Index every foreign key; firm_id ones back every row-level security check.
create index if not exists campaign_runs_campaign_idx on public.campaign_runs (campaign_id);
create index if not exists campaign_runs_firm_idx on public.campaign_runs (firm_id);
create index if not exists campaigns_firm_idx on public.campaigns (firm_id);
create index if not exists campaigns_created_by_idx on public.campaigns (created_by);
create index if not exists consents_firm_idx on public.consents (firm_id);
create index if not exists documents_firm_idx on public.documents (firm_id);
create index if not exists documents_contact_idx on public.documents (contact_id);
create index if not exists firm_invites_firm_idx on public.firm_invites (firm_id);
create index if not exists firm_invites_invited_by_idx on public.firm_invites (invited_by);
create index if not exists messages_campaign_run_idx on public.messages (campaign_run_id);
create index if not exists messages_contact_idx on public.messages (contact_id);
create index if not exists webhook_events_firm_idx on public.webhook_events (firm_id);

-- 2. One permissive policy per action: "for all" policies also apply to select,
--    so reads ran two checks. Split them into insert / update / delete.
drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_insert on public.campaigns for insert to authenticated with check (private.can_edit(firm_id));
create policy campaigns_update on public.campaigns for update to authenticated using (private.can_edit(firm_id)) with check (private.can_edit(firm_id));
create policy campaigns_delete on public.campaigns for delete to authenticated using (private.can_edit(firm_id));

drop policy if exists members_admin on public.firm_members;
create policy members_insert on public.firm_members for insert to authenticated with check (private.is_admin(firm_id));
create policy members_update on public.firm_members for update to authenticated using (private.is_admin(firm_id)) with check (private.is_admin(firm_id));
create policy members_delete on public.firm_members for delete to authenticated using (private.is_admin(firm_id));
