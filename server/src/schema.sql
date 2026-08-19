create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- mirrors the client's {get,set,del} shape: one JSON blob per (user, key).
-- today the client only ever uses KEY = 'gaja:plan:v1', but the shape allows more later.
create table if not exists store (
  user_id uuid not null references users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
