-- Notable — Comment likes & reports migration
-- Run this in the Supabase SQL editor to enable comment likes and moderation.

-- ── comment_likes ─────────────────────────────────────────────────────────────

create table if not exists comment_likes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id)  on delete cascade,
  comment_id  uuid        not null references comments(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  unique(user_id, comment_id)
);

alter table comment_likes enable row level security;

create policy "Anyone can view comment likes"
  on comment_likes for select using (true);

create policy "Users can insert their own comment likes"
  on comment_likes for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comment likes"
  on comment_likes for delete using (auth.uid() = user_id);

-- ── comment_reports ───────────────────────────────────────────────────────────

create table if not exists comment_reports (
  id          uuid        primary key default gen_random_uuid(),
  comment_id  uuid        not null references comments(id)  on delete cascade,
  reporter_id uuid        not null references profiles(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  unique(comment_id, reporter_id)
);

alter table comment_reports enable row level security;

create policy "Users can insert their own reports"
  on comment_reports for insert with check (auth.uid() = reporter_id);

create policy "Users can view their own reports"
  on comment_reports for select using (auth.uid() = reporter_id);
