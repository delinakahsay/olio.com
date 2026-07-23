-- Olio user table for Supabase (used when SUPABASE_URL / SUPABASE_SERVICE_KEY are set)
create table users (
  id uuid primary key,
  email text unique not null,
  passwordHash text not null,
  salt text not null,
  token text,
  savedItems jsonb default '[]',
  cart jsonb default '[]',
  orders jsonb default '[]',
  createdAt timestamptz default now()
);
