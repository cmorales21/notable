-- Notable — Mention notification triggers
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — functions use CREATE OR REPLACE, triggers are
-- dropped before being recreated.
--
-- Prerequisite: 'mention' must be in the notifications type check constraint
-- (migrate-mention-notifications.sql or migrate-collection-notifications.sql).
--
-- Parses @handles from newly inserted post descriptions and comment text —
-- the same regex the client editors use on the final stored text — and
-- notifies each mentioned user. Mentions are personal, so they are never
-- aggregated, and self-mentions are skipped. Handle matching is exact-case,
-- matching the previous client-side lookup.

-- ── 1. Trigger: new recommendation → mention notifications ───────────────────

create or replace function fn_notify_mention_rec()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handles text[];
begin
  if new.description is null then
    return new;
  end if;

  v_handles := array(
    select distinct m[1]
    from regexp_matches(new.description, '@([a-zA-Z0-9_]+)', 'g') m
  );

  if coalesce(array_length(v_handles, 1), 0) = 0 then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
  select p.id, 'mention', new.user_id, array[new.user_id], new.id
  from profiles p
  where p.handle = any(v_handles)
    and p.id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_mention_rec on recommendations;
create trigger trg_notify_mention_rec
  after insert on recommendations
  for each row execute function fn_notify_mention_rec();

-- ── 2. Trigger: new comment → mention notifications ──────────────────────────

create or replace function fn_notify_mention_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handles text[];
begin
  v_handles := array(
    select distinct m[1]
    from regexp_matches(new.text, '@([a-zA-Z0-9_]+)', 'g') m
  );

  if coalesce(array_length(v_handles, 1), 0) = 0 then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
  select p.id, 'mention', new.user_id, array[new.user_id], new.recommendation_id
  from profiles p
  where p.handle = any(v_handles)
    and p.id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_mention_comment on comments;
create trigger trg_notify_mention_comment
  after insert on comments
  for each row execute function fn_notify_mention_comment();
