-- Security tests for supabase/migrations/0001_schema.sql, run on a throwaway Postgres.
-- Every check prints PASS, or raises FAIL and stops the run.

create schema t;
grant usage on schema t to public;

create table t.ids (name text primary key, id uuid not null);
grant select on t.ids to public;
create function t.id(n text) returns uuid language sql stable as $$ select id from t.ids where name = n $$;

-- Act as a signed-in user (the "authenticated" role with that user's id in the JWT claim).
create function t.login(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', t.id(who)::text, true);
  set local role authenticated;
end $$;

create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
end $$;

create function t.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create function t.pass(msg text) returns void language plpgsql as $$ begin raise notice 'PASS: %', msg; end $$;

create function t.eq(actual bigint, expected bigint, msg text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', msg, expected, actual;
  end if;
  raise notice 'PASS: %', msg;
end $$;

create function t.count(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  return n;
end $$;

-- A statement that must be refused with an error.
create function t.denied(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'PASS: % (refused: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (it was allowed)', msg;
end $$;

-- A statement that must run and change exactly `expected` rows (0 = silently filtered by RLS).
create function t.rows(stmt text, expected bigint, msg text) returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  perform t.eq(n, expected, msg);
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner, like the SQL editor)
-- ---------------------------------------------------------------------------
insert into t.ids values
  ('owner', gen_random_uuid()), ('staffa', gen_random_uuid()), ('staffb', gen_random_uuid()),
  ('disabled', gen_random_uuid()), ('evil', gen_random_uuid()), ('m1', gen_random_uuid()), ('m2', gen_random_uuid()),
  ('acct1', gen_random_uuid()), ('acct2', gen_random_uuid()), ('invitee', gen_random_uuid()),
  ('upa', gen_random_uuid()), ('upb', gen_random_uuid()), ('ea1', gen_random_uuid()), ('eb1', gen_random_uuid()),
  ('pay1', gen_random_uuid()), ('pay2', gen_random_uuid()), ('news', gen_random_uuid());

-- Profile trigger
insert into auth.users (id, email, raw_app_meta_data) values (t.id('owner'), 'owner@neofit.test', '{"role":"owner"}');
insert into auth.users (id, email) values (t.id('staffa'), 'a@neofit.test'), (t.id('staffb'), 'b@neofit.test'), (t.id('disabled'), 'd@neofit.test');
-- Tries to make itself an owner through the editable user metadata:
insert into auth.users (id, email, raw_user_meta_data) values (t.id('evil'), 'evil@neofit.test', '{"role":"owner","full_name":"Evil"}');

-- Members: the desktop publishes the row first, then the invite creates the account.
insert into public.member_accounts (id, member_id, name, email, plan, status, expiry_date) values
  (t.id('acct1'), 'M-001', 'Member One', 'm1@example.com', 'Regular Plan - Monthly (No Treadmill)', 'Active', '2026-12-01'),
  (t.id('acct2'), 'M-002', 'Member Two', 'm2@example.com', 'Regular Plan - Monthly (No Treadmill)', 'Active', '2026-12-02');
insert into auth.users (id, email, raw_app_meta_data) values
  (t.id('m1'), 'm1@example.com', '{"kind":"member"}'),
  (t.id('m2'), 'M2@Example.com', '{}');  -- no marker, and a different letter case: the account row must still win
update public.member_accounts set user_id = t.id('m1') where id = t.id('acct1');
update public.member_accounts set user_id = t.id('m2') where id = t.id('acct2');
-- An invited address that has no account row yet, but is marked as a member:
insert into auth.users (id, email, raw_app_meta_data) values (t.id('invitee'), 'late@example.com', '{"kind":"member"}');

update public.profiles set is_active = false where id = t.id('disabled');

insert into public.logbook_uploads (id, date, staff_id, total_entries, total_amount) values
  (t.id('upa'), '2026-11-04', t.id('staffa'), 1, 450), (t.id('upb'), '2026-11-04', t.id('staffb'), 1, 90);
insert into public.logbook_entries (id, upload_id, name, amount, original_text) values
  (t.id('ea1'), t.id('upa'), 'Ian', 450, 'Ian - 450'), (t.id('eb1'), t.id('upb'), 'Rose', 90, 'Rose - 90');
insert into public.member_payments (id, account_id, receipt_no, amount, plan) values
  (t.id('pay1'), t.id('acct1'), '2026-1104-01', 700, 'Regular Plan - Monthly (No Treadmill)'),
  (t.id('pay2'), t.id('acct2'), '2026-1104-02', 700, 'Regular Plan - Monthly (No Treadmill)');
insert into public.announcements (id, title, body) values (t.id('news'), 'Holiday hours', 'Closed on Nov 1.');

-- ---------------------------------------------------------------------------
-- Profile trigger: who gets a profile, and as what
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.eq((select count(*) from public.profiles), 5, 'only staff and owner accounts get a profile (members and the invitee do not)');
  perform t.eq((select count(*) from public.profiles where id = t.id('owner') and role = 'owner'), 1, 'app_metadata role owner makes an owner');
  perform t.eq((select count(*) from public.profiles where id = t.id('evil') and role = 'staff'), 1, 'a role typed into user_metadata is ignored: staff');
  perform t.eq((select count(*) from public.profiles where id = t.id('m2')), 0, 'an email already in member_accounts gets no profile, whatever its letter case');
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.login('staffa');
  perform t.eq(t.count('select 1 from public.profiles'), 5, 'staff can read the profiles');
  perform t.denied(format('update public.profiles set role = ''owner'' where id = %L', t.id('staffa')), 'staff cannot make themselves an owner');
  perform t.rows(format('update public.profiles set is_active = true where id = %L', t.id('disabled')), 0, 'staff cannot re-enable an account');
  perform t.rows(format('update public.profiles set full_name = ''Staff A'' where id = %L', t.id('staffa')), 1, 'staff can change their own name');
  perform t.rows(format('update public.profiles set full_name = ''Hacked'' where id = %L', t.id('staffb')), 0, 'staff cannot change another profile');
  perform t.logout();

  perform t.login('owner');
  perform t.rows(format('update public.profiles set is_active = false where id = %L', t.id('staffb')), 1, 'the owner can disable a staff account');
  perform t.rows(format('update public.profiles set is_active = true where id = %L', t.id('staffb')), 1, 'the owner can enable it again');
  perform t.logout();

  perform t.login('m1');
  perform t.eq(t.count('select 1 from public.profiles'), 0, 'a member sees no profiles');
  perform t.logout();

  perform t.login('disabled');
  perform t.eq(t.count('select 1 from public.profiles'), 1, 'a disabled account can still read its own profile (to learn it is disabled), and nothing else');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- logbook_uploads and logbook_entries
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.login('staffa');
  perform t.eq(t.count('select 1 from public.logbook_uploads'), 2, 'staff can read every upload');
  perform t.eq(t.count('select 1 from public.logbook_entries'), 2, 'staff can read every entry');
  perform t.rows(format('insert into public.logbook_uploads (date, staff_id) values (''2026-11-05'', %L)', t.id('staffa')), 1, 'staff can insert an upload as themselves');
  perform t.denied(format('insert into public.logbook_uploads (date, staff_id) values (''2026-11-05'', %L)', t.id('staffb')), 'staff cannot insert an upload as someone else');
  perform t.rows(format('update public.logbook_uploads set total_amount = 500 where id = %L', t.id('upa')), 1, 'staff can update their own upload');
  perform t.denied(format('update public.logbook_uploads set staff_id = %L where id = %L', t.id('staffb'), t.id('upa')), 'staff cannot hand their upload to someone else');
  perform t.rows(format('update public.logbook_uploads set total_amount = 1 where id = %L', t.id('upb')), 0, 'staff cannot update another staff''s upload');
  perform t.rows(format('delete from public.logbook_uploads where id = %L', t.id('upb')), 0, 'staff cannot delete another staff''s upload');
  perform t.rows(format('insert into public.logbook_entries (upload_id, name) values (%L, ''Mine'')', t.id('upa')), 1, 'staff can add an entry to their upload');
  perform t.denied(format('insert into public.logbook_entries (upload_id, name) values (%L, ''Theirs'')', t.id('upb')), 'staff cannot add an entry to another staff''s upload');
  perform t.rows(format('update public.logbook_entries set amount = 1 where id = %L', t.id('eb1')), 0, 'staff cannot edit another staff''s entry');
  perform t.rows(format('delete from public.logbook_entries where id = %L', t.id('eb1')), 0, 'staff cannot delete another staff''s entry');
  perform t.logout();

  perform t.login('owner');
  perform t.rows(format('update public.logbook_entries set amount = 100 where id = %L', t.id('eb1')), 1, 'the owner can correct any entry');
  perform t.rows(format('update public.logbook_uploads set total_amount = 100 where id = %L', t.id('upb')), 1, 'the owner can recompute any upload');
  perform t.rows(format('insert into public.logbook_uploads (id, date, staff_id) values (gen_random_uuid(), ''2026-11-06'', %L)', t.id('owner')), 1, 'the owner can add a page as themselves');
  perform t.denied(format('insert into public.logbook_uploads (date, staff_id) values (''2026-11-06'', %L)', t.id('staffa')), 'the owner cannot add a page in a staff member''s name');
  perform t.rows(format('delete from public.logbook_entries where id = %L', t.id('eb1')), 1, 'the owner can delete any entry');
  perform t.rows(format('delete from public.logbook_uploads where id = %L', t.id('upb')), 1, 'the owner can delete any upload');
  perform t.logout();

  perform t.login('m1');
  perform t.eq(t.count('select 1 from public.logbook_uploads'), 0, 'a member cannot read uploads');
  perform t.eq(t.count('select 1 from public.logbook_entries'), 0, 'a member cannot read entries');
  perform t.denied(format('insert into public.logbook_uploads (date, staff_id) values (''2026-11-05'', %L)', t.id('m1')), 'a member cannot insert an upload');
  perform t.logout();

  perform t.login('disabled');
  perform t.eq(t.count('select 1 from public.logbook_uploads'), 0, 'a disabled account cannot read uploads, even with a session still open');
  perform t.denied(format('insert into public.logbook_uploads (date, staff_id) values (''2026-11-05'', %L)', t.id('disabled')), 'a disabled account cannot insert');
  perform t.logout();

  perform t.login('evil');
  perform t.denied(format('update public.profiles set role = ''owner'' where id = %L', t.id('evil')), 'the account that typed "owner" into user_metadata still cannot become one');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.login('staffa');
  perform t.rows(format('insert into public.devices (device_name, owner_id) values (''Phone'', %L)', t.id('staffa')), 1, 'a user can register their own device');
  perform t.denied(format('insert into public.devices (device_name, owner_id) values (''Phone'', %L)', t.id('staffb')), 'a user cannot register a device for someone else');
  perform t.logout();
  perform t.login('m1');
  perform t.eq(t.count('select 1 from public.devices'), 0, 'a member cannot read devices');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- member_accounts
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.login('m1');
  perform t.eq(t.count('select 1 from public.member_accounts'), 1, 'a member sees only their own row');
  perform t.eq(t.count(format('select 1 from public.member_accounts where id = %L', t.id('acct2'))), 0, 'a member cannot see another member''s row');
  perform t.rows(format('update public.member_accounts set push_token = ''ExponentPushToken[abc]'' where id = %L', t.id('acct1')), 1, 'a member can save their push token');
  perform t.denied(format('update public.member_accounts set plan = ''Free'' where id = %L', t.id('acct1')), 'a member cannot change their plan');
  perform t.denied(format('update public.member_accounts set expiry_date = ''2099-01-01'' where id = %L', t.id('acct1')), 'a member cannot extend their expiry date');
  perform t.denied(format('update public.member_accounts set user_id = %L where id = %L', t.id('m2'), t.id('acct1')), 'a member cannot hand their row to someone else');
  perform t.denied(format('update public.member_accounts set push_token = ''x'', status = ''Expired'' where id = %L', t.id('acct1')), 'a member cannot sneak another column in with the push token');
  perform t.rows(format('update public.member_accounts set push_token = ''x'' where id = %L', t.id('acct2')), 0, 'a member cannot change another member''s token');
  perform t.denied('insert into public.member_accounts (id, member_id, name, email, plan) values (gen_random_uuid(), ''M-099'', ''X'', ''x@x.co'', ''p'')', 'a member cannot create accounts');
  perform t.rows(format('delete from public.member_accounts where id = %L', t.id('acct1')), 0, 'a member cannot delete their account');
  perform t.logout();

  perform t.login('staffa');
  perform t.eq(t.count('select 1 from public.member_accounts'), 0, 'staff cannot read member accounts');
  perform t.rows(format('update public.member_accounts set name = ''X'' where id = %L', t.id('acct1')), 0, 'staff cannot change member accounts');
  perform t.logout();

  perform t.login('owner');
  perform t.eq(t.count('select 1 from public.member_accounts'), 2, 'the owner sees every member account');
  perform t.rows(format('update public.member_accounts set plan = ''Regular Plan - Daily (No Treadmill)'', expiry_date = ''2026-12-10'' where id = %L', t.id('acct1')), 1, 'the owner can publish changes to a member');
  perform t.rows('insert into public.member_accounts (id, member_id, name, email, plan) values (gen_random_uuid(), ''M-003'', ''Three'', ''three@example.com'', ''p'')', 1, 'the owner can publish a new member');
  perform t.denied('insert into public.member_accounts (id, member_id, name, email, plan) values (gen_random_uuid(), ''M-004'', ''Dup'', ''THREE@example.com'', ''p'')', 'two members cannot share an email address, whatever its letter case');
  perform t.rows('delete from public.member_accounts where member_id = ''M-003''', 1, 'the owner can remove a member');
  perform t.logout();

  perform t.login('disabled');
  perform t.eq(t.count('select 1 from public.member_accounts'), 0, 'a disabled account cannot read member accounts');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- member_payments
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.login('m1');
  perform t.eq(t.count('select 1 from public.member_payments'), 1, 'a member sees only their own payments');
  perform t.eq(t.count(format('select 1 from public.member_payments where id = %L', t.id('pay2'))), 0, 'a member cannot see another member''s payment');
  perform t.denied(format('insert into public.member_payments (id, account_id, receipt_no, amount, plan) values (gen_random_uuid(), %L, ''2026-1104-09'', 1, ''p'')', t.id('acct1')), 'a member cannot add a payment');
  perform t.rows(format('update public.member_payments set amount = 1 where id = %L', t.id('pay1')), 0, 'a member cannot change a payment');
  perform t.rows(format('delete from public.member_payments where id = %L', t.id('pay1')), 0, 'a member cannot delete a payment');
  perform t.logout();

  perform t.login('staffa');
  perform t.eq(t.count('select 1 from public.member_payments'), 0, 'staff cannot read member payments');
  perform t.logout();

  perform t.login('owner');
  perform t.eq(t.count('select 1 from public.member_payments'), 2, 'the owner sees every payment');
  perform t.rows(format('insert into public.member_payments (id, account_id, receipt_no, amount, plan) values (gen_random_uuid(), %L, ''2026-1104-03'', 700, ''p'')', t.id('acct1')), 1, 'the owner can publish a payment');
  perform t.denied(format('insert into public.member_payments (id, account_id, receipt_no, amount, plan) values (gen_random_uuid(), %L, ''2026-1104-03'', 700, ''p'')', t.id('acct1')), 'a receipt number cannot be used twice');
  perform t.denied(format('insert into public.member_payments (id, account_id, receipt_no, amount, plan) values (gen_random_uuid(), %L, ''2026-1104-04'', 0, ''p'')', t.id('acct1')), 'a payment must be more than zero');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- rates and announcements
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.login('m1');
  perform t.eq(t.count('select 1 from public.rates'), 4, 'a member can read the rates');
  perform t.eq(t.count('select 1 from public.announcements'), 1, 'a member can read announcements');
  perform t.rows('update public.rates set monthly = 1', 0, 'a member cannot change rates');
  perform t.denied('insert into public.announcements (title, body) values (''x'', ''y'')', 'a member cannot post announcements');
  perform t.rows('delete from public.announcements', 0, 'a member cannot delete announcements');
  perform t.logout();

  perform t.login('staffa');
  perform t.rows('update public.rates set monthly = 1', 0, 'staff cannot change rates');
  perform t.denied('insert into public.announcements (title, body) values (''x'', ''y'')', 'staff cannot post announcements');
  perform t.logout();

  perform t.login('owner');
  perform t.rows('update public.rates set monthly = monthly + 50 where category = ''Regular Plan'' and type = ''No Treadmill''', 1, 'the owner can change rates');
  perform t.rows('insert into public.announcements (title, body) values (''New'', ''Body'')', 1, 'the owner can post an announcement');
  perform t.denied('insert into public.announcements (title, body) values ('''', ''Body'')', 'an announcement needs a title');
  perform t.denied(format('insert into public.announcements (title, body) values (''x'', %L)', repeat('x', 501)), 'an announcement body is limited to 500 characters');
  perform t.rows('delete from public.announcements where title = ''New''', 1, 'the owner can remove an announcement');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- Not signed in
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.as_anon();
  perform t.denied('select 1 from public.rates', 'an anonymous caller cannot read rates');
  perform t.denied('select 1 from public.member_accounts', 'an anonymous caller cannot read member accounts');
  perform t.denied('select 1 from public.logbook_uploads', 'an anonymous caller cannot read uploads');
  perform t.denied('select 1 from public.announcements', 'an anonymous caller cannot read announcements');
  perform t.logout();
end $$;

-- ---------------------------------------------------------------------------
-- Trusted callers (the service role and the SQL editor have no auth.uid())
-- ---------------------------------------------------------------------------
do $$ begin
  perform t.rows(format('update public.member_accounts set last_reminder_on = ''2026-11-04'', push_token = null where id = %L', t.id('acct1')), 1, 'the service role can record reminders and clear tokens');
  perform t.rows(format('update public.profiles set role = ''owner'' where id = %L', t.id('staffb')), 1, 'the SQL editor can promote an owner');
end $$;

do $$ begin raise notice 'ALL SECURITY CHECKS PASSED'; end $$;
