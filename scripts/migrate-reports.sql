-- Notable — Reports migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — all statements use IF NOT EXISTS.

-- ── user_reports ──────────────────────────────────────────────────────────────

create table if not exists user_reports (
  id               uuid        primary key default gen_random_uuid(),
  reporter_id      uuid        not null references profiles(id) on delete cascade,
  reported_user_id uuid        not null references profiles(id) on delete cascade,
  reason           text        not null default '',
  created_at       timestamptz not null default now(),
  unique(reporter_id, reported_user_id)
);

alter table user_reports enable row level security;

create policy "Users can insert their own user reports"
  on user_reports for insert with check (auth.uid() = reporter_id);

create policy "Users can view their own user reports"
  on user_reports for select using (auth.uid() = reporter_id);

-- ── recommendation_reports ───────────────────────────────────────────────────

create table if not exists recommendation_reports (
  id                uuid        primary key default gen_random_uuid(),
  reporter_id       uuid        not null references profiles(id) on delete cascade,
  recommendation_id uuid        not null references recommendations(id) on delete cascade,
  reason            text        not null default '',
  created_at        timestamptz not null default now()
);

alter table recommendation_reports enable row level security;

create policy "Users can insert their own recommendation reports"
  on recommendation_reports for insert with check (auth.uid() = reporter_id);

create policy "Users can view their own recommendation reports"
  on recommendation_reports for select using (auth.uid() = reporter_id);

-- ── comment_reports — add reason column ──────────────────────────────────────
-- comment_reports already exists from migrate-comment-likes.sql

alter table comment_reports
  add column if not exists reason text not null default '';
