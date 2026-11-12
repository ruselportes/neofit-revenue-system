-- NeoFit Revenue System: cloud database (SDD Section 3.1.1 and Table 11.0).
-- Run once in the Supabase SQL editor, or with `supabase db push`.
-- Every table has Row-Level Security enabled; the anonymous role gets nothing.

alter database postgres set timezone to 'Asia/Manila';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        text not null check (role in ('staff', 'owner')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.logbook_uploads (
  id             uuid primary key default gen_random_uuid(),
  date           date not null,
  staff_id       uuid not null references public.profiles (id),
  image_url      text,
  total_entries  int not null default 0,
  total_amount   numeric(10, 2) not null default 0,
  is_synced      boolean not null default false,
  synced_at      timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.logbook_entries (
  id             uuid primary key default gen_random_uuid(),
  upload_id      uuid not null references public.logbook_uploads (id) on delete cascade,
  original_text  text not null default '',
  name           text not null,
  amount         numeric(10, 2),
  is_confirmed   boolean not null default true,
  is_duplicate   boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.devices (
  id             uuid primary key default gen_random_uuid(),
  device_name    text not null,
  owner_id       uuid not null references public.profiles (id),
  is_active      boolean not null default true,
  registered_at  timestamptz not null default now()
);

-- Cloud copy of each invited member. The desktop publishes the rows.
create table if not exists public.member_accounts (
  id                uuid primary key,
  member_id         text not null unique,
  user_id           uuid references auth.users (id) on delete set null,
  name              text not null,
  email             text not null,
  plan              text not null,
  status            text not null default 'Active'
                      check (status in ('Active', 'Expiring Soon', 'Expired', 'Pending')),
  joined_date       date,
  expiry_date       date,
  push_token        text,
  last_reminder_on  date,
  invited_at        timestamptz,
  updated_at        timestamptz not null default now()
);
create unique index if not exists member_accounts_email_key on public.member_accounts (lower(email));
create index if not exists member_accounts_user_id_idx on public.member_accounts (user_id);
create index if not exists member_accounts_expiry_idx on public.member_accounts (expiry_date);

create table if not exists public.member_payments (
  id            uuid primary key,
  account_id    uuid not null references public.member_accounts (id) on delete cascade,
  receipt_no    text not null unique,
  amount        numeric(10, 2) not null check (amount > 0),
  plan          text not null,
  period_start  date,
  period_end    date,
  paid_at       timestamptz not null default now()
);
create index if not exists member_payments_account_idx on public.member_payments (account_id, paid_at desc);

create table if not exists public.rates (
  category    text not null,
  type        text not null,
  monthly     numeric(10, 2) not null default 0,
  semi        numeric(10, 2) not null default 0,
  daily       numeric(10, 2) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (category, type)
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null check (char_length(body) between 1 and 500),
  posted_at  timestamptz not null default now()
);

create index if not exists logbook_uploads_date_idx on public.logbook_uploads (date);
create index if not exists logbook_uploads_staff_idx on public.logbook_uploads (staff_id);
create index if not exists logbook_entries_upload_idx on public.logbook_entries (upload_id);
create index if not exists announcements_posted_idx on public.announcements (posted_at desc);

-- NeoFit's official rates (Table 22.0). The desktop publishes changes later.
insert into public.rates (category, type, monthly, semi, daily) values
  ('Regular Plan',        'No Treadmill',   700, 350, 70),
  ('Regular Plan',        'With Treadmill', 900, 450, 90),
  ('Student/Senior Plan', 'No Treadmill',   600, 300, 60),
  ('Student/Senior Plan', 'With Treadmill', 800, 400, 80)
on conflict (category, type) do nothing;

-- ---------------------------------------------------------------------------
-- Who is who
-- ---------------------------------------------------------------------------
-- Used by the policies. SECURITY DEFINER so they can read profiles without
-- running into the profiles policies themselves. A disabled account is neither
-- staff nor owner, so disabling takes effect at once, even for a signed-in phone.

create or replace function public.is_staff_or_owner()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'owner'
  );
$$;

revoke all on function public.is_staff_or_owner() from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_staff_or_owner() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles are created by a trigger for staff and owner accounts only
-- ---------------------------------------------------------------------------
-- The role is never read from user_metadata, which a signed-in user can edit.
-- It comes from app_metadata (set only with the service role) and otherwise
-- defaults to staff; the owner is promoted with an UPDATE, see supabase/README.md.
-- A member's invite creates an auth account but no profile: the desktop publishes
-- the member's row before it asks for the invite, so the email is already there.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'kind', '') = 'member'
     or exists (select 1 from public.member_accounts m where lower(m.email) = lower(new.email)) then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    case when new.raw_app_meta_data ->> 'role' = 'owner' then 'owner' else 'staff' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guards: what a non-owner may never change, whatever the policy allows
-- ---------------------------------------------------------------------------
-- auth.uid() is null for the service role and for the SQL editor, which are trusted.

create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_owner() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.is_active is distinct from old.is_active then
      raise exception 'Only an owner can change a profile''s role or status.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- A member may change only push_token in their own row.
create or replace function public.guard_member_account_update()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_owner() then
    if (to_jsonb(new) - 'push_token' - 'updated_at') is distinct from (to_jsonb(old) - 'push_token' - 'updated_at') then
      raise exception 'Members can only change their push token.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists member_accounts_guard on public.member_accounts;
create trigger member_accounts_guard before update on public.member_accounts
  for each row execute function public.guard_member_account_update();

-- ---------------------------------------------------------------------------
-- Row-Level Security (Table 11.0)
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.logbook_uploads  enable row level security;
alter table public.logbook_entries  enable row level security;
alter table public.devices          enable row level security;
alter table public.member_accounts  enable row level security;
alter table public.member_payments  enable row level security;
alter table public.rates            enable row level security;
alter table public.announcements    enable row level security;

revoke all on all tables in schema public from anon;

-- profiles: a user can always read their own row (so the app can tell a disabled account apart)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff_or_owner());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

-- logbook_uploads
create policy uploads_select on public.logbook_uploads for select to authenticated
  using (public.is_staff_or_owner());
create policy uploads_insert on public.logbook_uploads for insert to authenticated
  with check (staff_id = auth.uid() and public.is_staff_or_owner());
create policy uploads_update on public.logbook_uploads for update to authenticated
  using (staff_id = auth.uid() and public.is_staff_or_owner())
  with check (staff_id = auth.uid());
create policy uploads_delete on public.logbook_uploads for delete to authenticated
  using ((staff_id = auth.uid() and public.is_staff_or_owner()) or public.is_owner());

-- The desktop signs in as the owner and corrects any page, so owners may also update uploads
-- (to recompute the totals after an edit).
create policy uploads_update_owner on public.logbook_uploads for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- logbook_entries
create policy entries_select on public.logbook_entries for select to authenticated
  using (public.is_staff_or_owner());
create policy entries_insert on public.logbook_entries for insert to authenticated
  with check (exists (
    select 1 from public.logbook_uploads u
    where u.id = upload_id and u.staff_id = auth.uid() and public.is_staff_or_owner()
  ));
create policy entries_update on public.logbook_entries for update to authenticated
  using (exists (
    select 1 from public.logbook_uploads u
    where u.id = upload_id and ((u.staff_id = auth.uid() and public.is_staff_or_owner()) or public.is_owner())
  ));
create policy entries_delete on public.logbook_entries for delete to authenticated
  using (exists (
    select 1 from public.logbook_uploads u
    where u.id = upload_id and ((u.staff_id = auth.uid() and public.is_staff_or_owner()) or public.is_owner())
  ));

-- devices
create policy devices_select on public.devices for select to authenticated
  using (public.is_staff_or_owner());
create policy devices_insert on public.devices for insert to authenticated
  with check (owner_id = auth.uid() and public.is_staff_or_owner());
create policy devices_update on public.devices for update to authenticated
  using (owner_id = auth.uid() and public.is_staff_or_owner());

-- member_accounts: a member reads and updates (push_token only, see the guard) their own row
create policy member_accounts_select on public.member_accounts for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy member_accounts_insert on public.member_accounts for insert to authenticated
  with check (public.is_owner());
create policy member_accounts_update on public.member_accounts for update to authenticated
  using (user_id = auth.uid() or public.is_owner())
  with check (user_id = auth.uid() or public.is_owner());
create policy member_accounts_delete on public.member_accounts for delete to authenticated
  using (public.is_owner());

-- member_payments
create policy member_payments_select on public.member_payments for select to authenticated
  using (
    public.is_owner()
    or exists (select 1 from public.member_accounts a where a.id = account_id and a.user_id = auth.uid())
  );
create policy member_payments_write on public.member_payments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- rates and announcements: any signed-in user reads, only an owner writes
create policy rates_select on public.rates for select to authenticated using (true);
create policy rates_write on public.rates for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy announcements_select on public.announcements for select to authenticated using (true);
create policy announcements_write on public.announcements for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
