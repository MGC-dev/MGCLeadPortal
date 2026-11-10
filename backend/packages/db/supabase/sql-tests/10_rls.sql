-- Row-level security tests. Run after 00_auth_stub.sql and the migrations, on a throwaway database.
-- Any failed check raises an exception, so psql -v ON_ERROR_STOP=1 exits non-zero.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@firm-one.test'),
  ('00000000-0000-0000-0000-00000000000b', 'member@firm-two.test'),
  ('00000000-0000-0000-0000-00000000000c', 'readonly@firm-one.test');

insert into firms (id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', 'Firm One LLP', 'firm-one'),
  ('10000000-0000-0000-0000-000000000002', 'Firm Two PC', 'firm-two');

insert into firm_members (firm_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'read_only');

insert into contacts (id, firm_id, name, phone_e164) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Rachel Greene', '+15552139364'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Kevin Huang', '+15552130000');

insert into consents (firm_id, contact_id, channel, status, source) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'sms', 'granted', 'web form');

insert into leads (id, firm_id, contact_id, title, source) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Contested divorce', 'web'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Car accident claim', 'ads');

insert into webhook_events (source, external_id, signature_ok, payload) values ('twilio', 'SM_seed', true, '{}');

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'RLS check failed: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- ---------- Firm One admin ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from contacts) = 1, 'admin sees only their own firm''s contacts');
select pg_temp.check((select count(*) from firms) = 1, 'admin sees only their own firm');
select pg_temp.check((select count(*) from webhook_events) = 0, 'raw webhooks are never readable from the client');
insert into contacts (firm_id, name, email) values ('10000000-0000-0000-0000-000000000001', 'Marcus Webb', 'marcus@example.com');
select pg_temp.check((select count(*) from contacts) = 2, 'admin can add a contact to their firm');

do $$ begin
  insert into contacts (firm_id, name, email) values ('10000000-0000-0000-0000-000000000002', 'Intruder', 'x@example.com');
  raise exception 'RLS check failed: admin wrote into another firm';
exception when insufficient_privilege then raise notice 'ok: admin cannot write into another firm';
end $$;

update consents set status = 'revoked';
select pg_temp.check((select count(*) from consents where status = 'granted') = 1, 'consent history cannot be rewritten');

-- leads, history and stage rules
select pg_temp.check((select count(*) from leads) = 1, 'admin sees only their own firm''s leads');
update leads set stage = 'consult' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) from lead_events where lead_id = '30000000-0000-0000-0000-000000000001' and kind = 'stage_changed' and from_stage = 'new' and to_stage = 'consult') = 1, 'a stage change writes its own history');
select pg_temp.check((select actor from lead_events where kind = 'stage_changed' limit 1) = '00000000-0000-0000-0000-00000000000a', 'history records who moved the lead');
do $$ begin
  update leads set stage = 'lost' where id = '30000000-0000-0000-0000-000000000001';
  raise exception 'RLS check failed: lost without a reason';
exception when check_violation then raise notice 'ok: a lead cannot be marked lost without a reason';
end $$;
update leads set stage = 'lost', lost_reason = 'Fee too high' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.check((select closed_at is not null from leads where id = '30000000-0000-0000-0000-000000000001'), 'losing a lead closes it');
do $$ begin
  update leads set stage = 'signed' where id = '30000000-0000-0000-0000-000000000001';
  raise exception 'RLS check failed: lost lead jumped to signed';
exception when check_violation then raise notice 'ok: a lost lead can only be reopened as new';
end $$;
do $$ begin
  insert into lead_events (firm_id, lead_id, kind) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'stage_changed');
  raise exception 'RLS check failed: client forged history';
exception when insufficient_privilege then raise notice 'ok: clients cannot write lead history';
end $$;
do $$ begin
  insert into leads (firm_id, contact_id, title, source) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Stolen contact', 'web');
  raise exception 'RLS check failed: lead linked to another firm''s contact';
exception when foreign_key_violation then raise notice 'ok: a lead cannot point at another firm''s contact';
end $$;
insert into notes (firm_id, lead_id, author_id, body) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Called, left voicemail');
insert into tasks (firm_id, lead_id, title, due_at) values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Call back', now() + interval '1 hour');
select pg_temp.check((select count(*) from notes) = 1 and (select count(*) from tasks) = 1, 'admin can add notes and tasks');
reset role;

-- ---------- Firm Two member ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from contacts) = 1, 'member of another firm sees only their own contact');
select pg_temp.check(not exists (select 1 from contacts where name = 'Rachel Greene'), 'firm two cannot see firm one''s lead');
select pg_temp.check((select count(*) from firm_members) = 1, 'member sees only their own firm''s team');
select pg_temp.check(not exists (select 1 from leads where title = 'Contested divorce'), 'firm two cannot see firm one''s leads');
select pg_temp.check((select count(*) from notes) = 0 and (select count(*) from tasks) = 0 and (select count(*) from lead_events where firm_id = '10000000-0000-0000-0000-000000000001') = 0, 'firm two cannot see firm one''s notes, tasks or history');
do $$ begin
  insert into notes (firm_id, lead_id, author_id, body) values ('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Pretending to be someone else');
  raise exception 'RLS check failed: note written as another user';
exception when insufficient_privilege then raise notice 'ok: notes can only be written as yourself';
end $$;
reset role;

-- ---------- Firm One read-only ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from contacts) = 2, 'read-only user can read their firm''s contacts');
do $$ begin
  insert into contacts (firm_id, name, email) values ('10000000-0000-0000-0000-000000000001', 'Nope', 'nope@example.com');
  raise exception 'RLS check failed: read-only user wrote a contact';
exception when insufficient_privilege then raise notice 'ok: read-only user cannot add contacts';
end $$;
select pg_temp.check((select count(*) from audit_log) = 0, 'audit log is admin-only');
do $$ begin
  insert into custom_field_definitions (firm_id, key, label, type) values ('10000000-0000-0000-0000-000000000001', 'incident_date', 'Date of incident', 'date');
  raise exception 'RLS check failed: read-only user defined a custom field';
exception when insufficient_privilege then raise notice 'ok: only admins define custom fields';
end $$;
reset role;

-- ---------- anonymous ----------
set role authenticated;
reset request.jwt.claim.sub;
select pg_temp.check((select count(*) from contacts) = 0, 'a signed-out request sees nothing');
reset role;
