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

insert into firm_twenty (firm_id, base_url, workspace_id, api_key_encrypted) values
  ('10000000-0000-0000-0000-000000000001', 'http://twenty:3000', 'ws_1', 'enc:secret');

insert into contacts (id, firm_id, name, phone_e164) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Rachel Greene', '+15552139364'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Kevin Huang', '+15552130000');

insert into consents (firm_id, contact_id, channel, status, source) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'sms', 'granted', 'web form');

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
select pg_temp.check((select count(*) from firm_twenty) = 0, 'Twenty API keys are never readable from the client');
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
reset role;

-- ---------- Firm Two member ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from contacts) = 1, 'member of another firm sees only their own contact');
select pg_temp.check(not exists (select 1 from contacts where name = 'Rachel Greene'), 'firm two cannot see firm one''s lead');
select pg_temp.check((select count(*) from firm_members) = 1, 'member sees only their own firm''s team');
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
reset role;

-- ---------- anonymous ----------
set role authenticated;
reset request.jwt.claim.sub;
select pg_temp.check((select count(*) from contacts) = 0, 'a signed-out request sees nothing');
reset role;
