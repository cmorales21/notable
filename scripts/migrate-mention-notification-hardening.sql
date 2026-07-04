-- Notable — Mention notification hardening
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query).
-- Safe to run multiple times — functions use CREATE OR REPLACE, triggers are
-- dropped before being recreated.
--
-- Prerequisite: migrate-mention-notification-trigger.sql (creates the two
-- functions this migration replaces).
--
-- Adds three defenses to both mention triggers:
--   1. Cap distinct mentioned handles at 20 per rec/comment (soft anti-spam).
--   2. Skip mentions between users blocked in either direction (via user_blocks).
--   3. Skip mentions from private-profile actors to non-followers (so a private
--      user cannot reveal themselves to strangers via an @mention).
--
-- All three checks live in the WHERE clause of the INSERT … SELECT — no error
-- is thrown when a mention is filtered out, the notification row is simply
-- never created.

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

  -- Cap distinct mentioned handles at 20 per rec (anti-spam soft rail)
  v_handles := array(
    select distinct m[1]
    from regexp_matches(new.description, '@([a-zA-Z0-9_]+)', 'g') m
    limit 20
  );

  if coalesce(array_length(v_handles, 1), 0) = 0 then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
  select p.id, 'mention', new.user_id, array[new.user_id], new.id
  from profiles p
  where p.handle = any(v_handles)
    and p.id <> new.user_id
    -- Skip if either party blocked the other
    and not exists (
      select 1 from user_blocks ub
      where (ub.blocker_id = p.id       and ub.blocked_id = new.user_id)
         or (ub.blocker_id = new.user_id and ub.blocked_id = p.id)
    )
    -- If the actor's profile is private, only notify recipients who already
    -- follow them (status = 'accepted' or a legacy null status for old rows).
    and (
      not exists (
        select 1 from profiles ap
        where ap.id = new.user_id and ap.profile_private = true
      )
      or exists (
        select 1 from follows f
        where f.follower_id  = p.id
          and f.following_id = new.user_id
          and (f.status = 'accepted' or f.status is null)
      )
    );

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
  -- Cap distinct mentioned handles at 20 per comment (anti-spam soft rail)
  v_handles := array(
    select distinct m[1]
    from regexp_matches(new.text, '@([a-zA-Z0-9_]+)', 'g') m
    limit 20
  );

  if coalesce(array_length(v_handles, 1), 0) = 0 then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, actor_ids, rec_id)
  select p.id, 'mention', new.user_id, array[new.user_id], new.recommendation_id
  from profiles p
  where p.handle = any(v_handles)
    and p.id <> new.user_id
    -- Skip if either party blocked the other
    and not exists (
      select 1 from user_blocks ub
      where (ub.blocker_id = p.id       and ub.blocked_id = new.user_id)
         or (ub.blocker_id = new.user_id and ub.blocked_id = p.id)
    )
    -- If the actor's profile is private, only notify recipients who already
    -- follow them (status = 'accepted' or a legacy null status for old rows).
    and (
      not exists (
        select 1 from profiles ap
        where ap.id = new.user_id and ap.profile_private = true
      )
      or exists (
        select 1 from follows f
        where f.follower_id  = p.id
          and f.following_id = new.user_id
          and (f.status = 'accepted' or f.status is null)
      )
    );

  return new;
end;
$$;

drop trigger if exists trg_notify_mention_comment on comments;
create trigger trg_notify_mention_comment
  after insert on comments
  for each row execute function fn_notify_mention_comment();
