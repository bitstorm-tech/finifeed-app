-- Slice 1: users, creators, their source accounts and user subscriptions (spec §8, §9).

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table creators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table source_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators (id),
  source_type text not null check (source_type in ('YOUTUBE')),
  external_id text not null,
  handle text,
  display_name text not null,
  canonical_url text not null,
  avatar_url text,
  source_metadata jsonb not null default '{}',
  last_synced_at timestamptz,
  sync_status text not null default 'PENDING' check (sync_status in ('PENDING', 'OK', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, external_id)
);

create index source_accounts_creator_id_idx on source_accounts (creator_id);

create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  creator_id uuid not null references creators (id),
  priority text not null default 'NORMAL' check (priority in ('HIGH', 'NORMAL', 'LOW')),
  followed_at timestamptz not null default now(),
  inbox_from timestamptz not null,
  active boolean not null default true,
  unique (user_id, creator_id)
);
