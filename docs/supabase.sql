-- ============================================================================
-- Olio: Supabase schema
-- ============================================================================
-- Safe to run on a fresh project OR over the previous `users` table.
-- Every statement is idempotent, so running it twice changes nothing.
--
-- Paste the whole file into the Supabase SQL editor and run it once.
--
-- WHAT THIS FIXES
--   1. The previous table had no `name` column, but the API always sends one,
--      so every INSERT was rejected and registration failed with "Server error".
--   2. Unquoted camelCase in the old file (passwordHash, savedItems, createdAt)
--      was folded to lowercase by Postgres, so the real column names never
--      matched what the file said. Everything is explicit snake_case now.
--   3. The session token lived in a column on `users`, which meant one session
--      per account: signing in anywhere signed you out everywhere, tokens never
--      expired, and they were stored in plain text. Sessions are now their own
--      table, hashed, with an expiry.
--   4. Row Level Security was off. Without it, anyone holding the project's
--      anon key could read every row of `users`, including password hashes.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text        not null,
  name          text        not null default '',
  password_hash text        not null,
  salt          text        not null,
  saved_items   jsonb       not null default '[]'::jsonb,
  cart          jsonb       not null default '[]'::jsonb,
  orders        jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Bring an existing table up to the shape above. Each step is conditional, so
-- this is a no-op on a table that is already correct.
do $$
begin
  -- Postgres lowercased these when the old file created them unquoted.
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='passwordhash')
     and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='password_hash') then
    alter table public.users rename column passwordhash to password_hash;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='saveditems')
     and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='saved_items') then
    alter table public.users rename column saveditems to saved_items;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='createdat')
     and not exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='users' and column_name='created_at') then
    alter table public.users rename column createdat to created_at;
  end if;
end $$;

-- The column whose absence was breaking registration.
alter table public.users add column if not exists name       text        not null default '';
alter table public.users add column if not exists saved_items jsonb      not null default '[]'::jsonb;
alter table public.users add column if not exists cart        jsonb      not null default '[]'::jsonb;
alter table public.users add column if not exists orders      jsonb      not null default '[]'::jsonb;
alter table public.users add column if not exists created_at  timestamptz not null default now();
alter table public.users add column if not exists updated_at  timestamptz not null default now();

-- Case-insensitive uniqueness, enforced by the database rather than by hoping
-- every code path remembers to lowercase first. No extension needed.
drop index if exists public.users_email_key;
create unique index if not exists users_email_lower_key on public.users (lower(email));

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- 2. SESSIONS
-- ---------------------------------------------------------------------------
-- One row per signed-in device. The raw token never lands in the database:
-- the server stores sha256(token), so a dump of this table cannot be replayed
-- as a login.

create table if not exists public.sessions (
  token_hash   text        primary key,
  user_id      uuid        not null references public.users(id) on delete cascade,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days')
);

create index if not exists sessions_user_id_idx  on public.sessions (user_id);
create index if not exists sessions_expires_idx  on public.sessions (expires_at);

-- Retire the old single-token column. Everyone signs in once more after this.
alter table public.users drop column if exists token;

-- Call this from a cron job, or just let it run on deploy. Expired rows are
-- already rejected by the API; this only stops the table growing forever.
create or replace function public.purge_expired_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.sessions where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end $$;


-- ---------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- This is the important part. A Supabase project's anon key is public by
-- design, and PostgREST will happily serve any table that does not refuse it.
-- With RLS on and no policies attached, anon and authenticated get nothing,
-- while the service_role key the API uses bypasses RLS entirely and keeps
-- working. Do not add policies here unless you start querying from the browser.

alter table public.users    enable row level security;
alter table public.sessions enable row level security;

alter table public.users    force row level security;
alter table public.sessions force row level security;

revoke all on public.users    from anon, authenticated;
revoke all on public.sessions from anon, authenticated;
revoke all on function public.purge_expired_sessions() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. CHECK IT WORKED
-- ---------------------------------------------------------------------------
-- Expect: both tables listed, rowsecurity = true for each.
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public' and tablename in ('users','sessions');
--
-- Expect the users columns to be exactly:
--   id, email, name, password_hash, salt, saved_items, cart, orders,
--   created_at, updated_at
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'users'
--   order by ordinal_position;
